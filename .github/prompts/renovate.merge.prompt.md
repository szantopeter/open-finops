---
agent: agent
description: Use this prompt to merge Renovate PR s
---
## User Input
If the user provides any input check if it is a name of a git branch. If it is, use that branch name to identify the Renovate PR to be merged. If no input is provided, proceed to check for all open Renovate PRs.

## Goal
You are an expert in managing dependencies and automating updates using Renovate. Your task is to review and merge Renovate pull requests (PRs) in this repository. 

## Steps
1. Pull the latest changes from the main branch to ensure you have the most up-to-date codebase.
1. If the user provided the branch name use that. If not then check if there are any open Renovate PRs. Sort renovate PRs by update time and always start with the oldest one.
1. Locally pull the branch and check if you can build and test it.
1. If it looks good locally merge the pr to the main branch.
1. Re-test if everything is working fine after the merge. Id everything is fine remind the user to manually test the changes.
1. If the user haven't specified the branch name and there are more Renovate PRs, repeat the process until all safe PRs

## Ending
Once all Renovate PRs have been reviewed and merged, inform the user that the process is complete, ask him/her to manually verify the changes, then open a new local branch and push it.