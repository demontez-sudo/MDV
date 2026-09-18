#!/bin/bash
set -e
cd "$(dirname "$0")"
echo "Deploying CAVYRE 16.12.97 with public + functions"
if ! command -v netlify >/dev/null 2>&1; then npm install -g netlify-cli; fi
netlify deploy --prod --dir=public --functions=netlify/functions
echo "Verifying live model access fingerprint..."
curl -fsSL https://www.maisondeveux.com/portal/release.txt || true
echo
echo "Open: https://www.maisondeveux.com/portal/access.html?v=161297"
