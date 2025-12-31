
# Create a temporary directory for deployment
$deployDir = "aws-deploy"
if (Test-Path $deployDir) { Remove-Item -Recurse -Force $deployDir }
New-Item -ItemType Directory -Path $deployDir

# Copy Backend Files
Copy-Item "server.js" -Destination $deployDir
Copy-Item "package.json" -Destination $deployDir
Copy-Item "routes" -Destination $deployDir -Recurse
Copy-Item "scripts" -Destination $deployDir -Recurse
Copy-Item "database" -Destination $deployDir -Recurse

# Copy Frontend Files
New-Item -ItemType Directory -Path "$deployDir\client"
# Use local build artifacts (npm run build must be run before this script)
Copy-Item "client\build" -Destination "$deployDir\client" -Recurse

# Create zip file
$zipFile = "aws-deploy.zip"
if (Test-Path $zipFile) { Remove-Item -Force $zipFile }
Compress-Archive -Path "$deployDir\*" -DestinationPath $zipFile

Write-Host "Deployment package created: $zipFile"
