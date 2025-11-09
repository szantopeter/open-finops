#!/usr/bin/env bash
set -euo pipefail

# generate-pricing.sh
# Logs in with AWS SSO (if necessary), exports environment variables for the AWS SDK,
# then runs the Node pricing generator in this folder.
# Usage:
#   ./generate-pricing.sh [--print-env] [--profile my-sso-profile] [--regions=...] [--instances=...] [--out=...]
# Examples:
#   ./generate-pricing.sh --regions=us-east-1 --instances=db.t3.medium
#   # Run with default output (writes into src/assets/pricing):
#   ./generate-pricing.sh
#   # Print env variables (may still attempt SSO login depending on your aws config):
#   eval "$(./generate-pricing.sh --print-env)"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

PRINT_ENV=0
PROFILE="${AWS_PROFILE:-}"
declare -a NODE_ARGS
NODE_ARGS=()
INSECURE=0
CA_FILE=""

# Auto-detect CA bundle in the script directory
SCRIPT_DIR_FOR_CA="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -z "$CA_FILE" ] && [ -f "$SCRIPT_DIR_FOR_CA/combined-ca-bundle.pem" ]; then
  CA_FILE="$SCRIPT_DIR_FOR_CA/combined-ca-bundle.pem"
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --insecure)
      INSECURE=1; shift ;;
    --ca-file)
      CA_FILE="$2"; shift 2 ;;
    --ca-file=*)
      CA_FILE="${1#--ca-file=}"; shift ;;
    --print-env)
      PRINT_ENV=1; shift ;;
    --profile)
      PROFILE="$2"; shift 2 ;;
    --profile=*)
      PROFILE="${1#--profile=}"; shift ;;
    --help|-h)
      echo "Usage: $0 [--print-env] [--profile name] [node-generator-args...]";
      exit 0 ;;
    *)
      NODE_ARGS+=("$1"); shift ;;
  esac
done

# If no profile provided, try to pick the first profile section from ~/.aws/config
if [ -z "$PROFILE" ]; then
  CONFIG_FILE="${AWS_CONFIG_FILE:-$HOME/.aws/config}"
  if [ -f "$CONFIG_FILE" ]; then
    first_section=$(grep -E '^\[.*\]' "$CONFIG_FILE" | head -n1 | sed -E 's/^\[(.*)\]$/\1/' || true)
    if [ -n "$first_section" ]; then
      PROFILE="${first_section#profile }"
      echo "No profile supplied — using first profile from $CONFIG_FILE: $PROFILE"
    fi
  fi
fi

# Set AWS_PROFILE early so Node script can use it
if [ -n "$PROFILE" ]; then
  export AWS_PROFILE="$PROFILE"
fi

if ! command -v aws >/dev/null 2>&1; then
  echo "aws CLI not found in PATH. Install AWS CLI v2 and re-run." >&2
  exit 3
fi

echo "Starting AWS SSO login for profile: ${PROFILE:-<none>}"

# Run interactive SSO login if profile is set (otherwise still try)
if [ -n "$PROFILE" ]; then
  aws sso login --profile "$PROFILE"
else
  aws sso login || true
fi

# Default exports for Node SDK
export AWS_SDK_LOAD_CONFIG=1
if [ -n "$PROFILE" ]; then
  export AWS_PROFILE="$PROFILE"
fi
export AWS_DEFAULT_REGION="us-east-1"

# Verify session
if ! aws sts get-caller-identity ${PROFILE:+--profile $PROFILE} >/dev/null 2>&1; then
  echo "Failed to verify credentials after SSO login for profile $PROFILE" >&2
  exit 5
fi

# Prepare an env helper file in the tool directory
ENV_FILE="$SCRIPT_DIR/aws-sso-env.sh"
cat > "$ENV_FILE" <<EOF
#!/usr/bin/env bash
export AWS_SDK_LOAD_CONFIG=1
EOF
if [ -n "$PROFILE" ]; then
  cat >> "$ENV_FILE" <<EOF
export AWS_PROFILE=$PROFILE
EOF
fi
cat >> "$ENV_FILE" <<EOF
export AWS_DEFAULT_REGION=us-east-1
EOF
chmod 600 "$ENV_FILE"

if [ "$PRINT_ENV" -eq 1 ]; then
  # Print exports for eval usage
  printf 'export AWS_SDK_LOAD_CONFIG=1\n'
  if [ -n "$PROFILE" ]; then
    printf 'export AWS_PROFILE=%s\n' "$PROFILE"
  fi
  printf 'export AWS_DEFAULT_REGION=us-east-1\n'
  exit 0
fi

echo "SSO login successful for profile: ${PROFILE:-<none>}"
echo "Wrote env helper: $ENV_FILE"

# Now run the node generator inside the tool directory
pushd "$SCRIPT_DIR" >/dev/null
# If user didn't pass --regions/--instances/--out, provide sensible defaults
has_arg() {
  local needle="$1";
  shift;
  for a in "$@"; do
    case "$a" in
      "$needle"|$needle=*) return 0 ;;
    esac;
  done;
  return 1;
}

# defaults
DEFAULT_REGIONS="us-east-1,eu-west-1"
DEFAULT_INSTANCES=""
DEFAULT_OUT="../../src/assets/pricing"
DEFAULT_ALL_INSTANCES="--all-instances"

ARGS_TO_PASS=()
if [ ${#NODE_ARGS[@]} -gt 0 ]; then
  ARGS_TO_PASS=("${NODE_ARGS[@]}")
fi
if [ ${#ARGS_TO_PASS[@]} -eq 0 ]; then
  ARGS_TO_PASS=("--regions=${DEFAULT_REGIONS}" "${DEFAULT_ALL_INSTANCES}" "--out=${DEFAULT_OUT}")
else
  if ! has_arg --regions "${ARGS_TO_PASS[@]}" && ! has_arg --regions= "${ARGS_TO_PASS[@]}"; then
    ARGS_TO_PASS+=("--regions=${DEFAULT_REGIONS}")
  fi
  if ! has_arg --instances "${ARGS_TO_PASS[@]}" && ! has_arg --instances= "${ARGS_TO_PASS[@]}" && ! has_arg --all-instances "${ARGS_TO_PASS[@]}"; then
    ARGS_TO_PASS+=("${DEFAULT_ALL_INSTANCES}")
  fi
  if ! has_arg --out "${ARGS_TO_PASS[@]}" && ! has_arg --out= "${ARGS_TO_PASS[@]}"; then
    ARGS_TO_PASS+=("--out=${DEFAULT_OUT}")
  fi
fi

echo "Running node generate-pricing.js ${ARGS_TO_PASS[*]}"
# Determine the actual output argument passed (support --out=path and --out path)
OUT_USED="${DEFAULT_OUT}"
for a in "${ARGS_TO_PASS[@]}"; do
  case "$a" in
    --out=*) OUT_USED="${a#--out=}" ;;
  esac
done
for ((i=0;i<${#ARGS_TO_PASS[@]};i++)); do
  if [ "${ARGS_TO_PASS[$i]}" = "--out" ]; then
    if [ $((i+1)) -lt ${#ARGS_TO_PASS[@]} ]; then
      OUT_USED="${ARGS_TO_PASS[$((i+1))]}"
    fi
  fi
done
# Apply TLS/CA runtime options only for this node invocation
if [ "${INSECURE:-0}" = "1" ]; then
  echo "WARNING: Running node with NODE_TLS_REJECT_UNAUTHORIZED=0 (insecure, skips TLS verification)"
  export NODE_TLS_REJECT_UNAUTHORIZED=0
fi
if [ -n "${CA_FILE:-}" ]; then
  if [ ! -f "$CA_FILE" ]; then
    echo "Specified CA file does not exist: $CA_FILE" >&2
    exit 6
  fi
  export NODE_EXTRA_CA_CERTS="$CA_FILE"
  export AWS_CA_BUNDLE="$CA_FILE"
  export SSL_CERT_FILE="$CA_FILE"
  echo "Using additional CA certs from: $CA_FILE"
fi

node generate-pricing.js "${ARGS_TO_PASS[@]}"
STATUS=$?
popd >/dev/null

if [ $STATUS -ne 0 ]; then
  echo "Pricing generator failed with exit code $STATUS" >&2
  exit $STATUS
fi

echo "Pricing generation completed."
exit 0
