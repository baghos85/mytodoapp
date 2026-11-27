using 'core.bicep'

// Read from the GitHub repo variable SQL_ADMIN_GROUP_OBJECT_ID by deploy.yml. Never hard-code it here.
param sqlAdminGroupObjectId = readEnvironmentVariable('SQL_ADMIN_GROUP_OBJECT_ID')
