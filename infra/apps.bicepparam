using 'apps.bicep'

// Image tags (commit SHAs) are set by deploy.yml step 4.
param apiImageTag = readEnvironmentVariable('API_IMAGE_TAG')
param webImageTag = readEnvironmentVariable('WEB_IMAGE_TAG')
param migrateImageTag = readEnvironmentVariable('MIGRATE_IMAGE_TAG')
