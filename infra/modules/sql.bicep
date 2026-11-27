@description('SQL logical server name (globally unique).')
param serverName string

@description('Database name.')
param databaseName string

@description('Azure region.')
param location string

@description('Tags for every resource.')
param tags object

@description('Display name of the Entra group that is the SQL Entra admin.')
param adminGroupName string

@description('Object id of the Entra admin group (GitHub variable SQL_ADMIN_GROUP_OBJECT_ID; an identifier, not a secret).')
@minLength(36)
@maxLength(36)
param adminGroupObjectId string

resource server 'Microsoft.Sql/servers@2025-01-01' = {
  name: serverName
  location: location
  tags: tags
  properties: {
    version: '12.0'
    minimalTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled'
    // Entra-only authentication: no SQL logins or passwords (ADR-019).
    administrators: {
      administratorType: 'ActiveDirectory'
      principalType: 'Group'
      login: adminGroupName
      sid: adminGroupObjectId
      tenantId: tenant().tenantId
      azureADOnlyAuthentication: true
    }
  }
}

// Only the "Allow Azure services" rule (0.0.0.0). No client-IP rules (public repo, ADR-019).
resource allowAzureServices 'Microsoft.Sql/servers/firewallRules@2025-01-01' = {
  parent: server
  name: 'AllowAllWindowsAzureIps'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

resource database 'Microsoft.Sql/servers/databases@2025-01-01' = {
  parent: server
  name: databaseName
  location: location
  tags: tags
  // Serverless, as in Microsoft's free-offer template (2 vCores; AutoPause caps it at 4 vCores / 32 GB).
  sku: {
    name: 'GP_S_Gen5'
    tier: 'GeneralPurpose'
    family: 'Gen5'
    capacity: 2
  }
  // Free offer (ADR-017). No maxSizeBytes, minCapacity or autoPauseDelay: the free offer allows only the
  // default max size (32 GB) and fixes auto-pause at 15 minutes; setting them fails the deployment.
  properties: {
    collation: 'SQL_Latin1_General_CP1_CI_AS'
    zoneRedundant: false
    // Backups stay in France Central (privacy notice).
    requestedBackupStorageRedundancy: 'Local'
    // Pause for the rest of the month when the allowance is used up. Never 'BillOverUsage'.
    useFreeLimit: true
    freeLimitExhaustionBehavior: 'AutoPause'
  }
}

// Point-in-time restore is 7 days (privacy notice, SPEC 7.8). With AutoPause the free offer fixes PITR at
// 7 days and LRS, so there is no backupShortTermRetentionPolicies resource. Add one with retentionDays: 7
// if the database ever leaves the free offer.

output serverName string = server.name
output serverFqdn string = server.properties.fullyQualifiedDomainName
output databaseName string = database.name
