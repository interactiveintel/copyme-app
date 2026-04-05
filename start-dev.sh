#!/bin/bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
export PATH="/Users/paulpereira/.nvm/versions/node/v20.20.2/bin:$PATH"
cd /Users/paulpereira/Desktop/CopyMe/copyme-app
exec npx next dev
