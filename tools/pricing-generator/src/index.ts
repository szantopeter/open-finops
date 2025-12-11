#!/usr/bin/env node

import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { loadSharedConfigFiles } from '@aws-sdk/shared-ini-file-loader';
import { spawn } from 'node:child_process';

async function main(): Promise<void> {
  await awsLogin();
}

main();

async function awsLogin() {
  try {
    const config = await loadSharedConfigFiles();
    const profiles = Object.keys(config.configFile || {});
    if (profiles.length === 0) {
      throw new Error('No AWS profiles found in ~/.aws/config');
    }
    const firstProfile = profiles[0];
    console.log(`Using AWS profile: ${firstProfile}`);

    // Set the profile for the client
    process.env.AWS_PROFILE = firstProfile;

    // Create STS client (region will be loaded from profile or default)
    let client = new STSClient({});

    let response;
    try {
      const command = new GetCallerIdentityCommand({});
      response = await client.send(command);
    } catch (apiError: any) {
      if (apiError.message && (apiError.message.includes('Token is expired') || apiError.message.includes('not found or is invalid'))) {
        console.log('SSO session invalid or expired, running aws sso login...');
        await new Promise<void>((resolve, reject) => {
          const loginProcess = spawn('aws', ['sso', 'login', '--profile', firstProfile], {
            stdio: 'inherit'
          });
          loginProcess.on('close', (code) => {
            if (code === 0) {
              resolve();
            } else {
              reject(new Error(`aws sso login failed with code ${code}`));
            }
          });
          loginProcess.on('error', reject);
        });
        console.log('Login completed, retrying API call...');
        // Create a new client to pick up fresh credentials
        client = new STSClient({});
        const command = new GetCallerIdentityCommand({});
        response = await client.send(command);
      } else {
        throw apiError;
      }
    }

    console.log('AWS API Call Successful!');
    console.log('Account ID:', response.Account);
    console.log('User ID:', response.UserId);
    console.log('ARN:', response.Arn);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

