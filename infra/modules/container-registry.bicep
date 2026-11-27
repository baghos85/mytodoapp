@description('Registry name (globally unique, alphanumeric).')
param name string

@description('Azure region.')
param location string

@description('Tags for every resource.')
param tags object

@description('User-assigned identities (names, same resource group) that get AcrPull on this registry.')
param pullIdentityNames string[]

// Built-in role "AcrPull". The deploy identity may assign only this role (ADR-005).
var acrPullRoleId = subscriptionResourceId(
  'Microsoft.Authorization/roleDefinitions',
  '7f951dda-4ed3-4680-a7ca-43fe172d538d'
)

resource registry 'Microsoft.ContainerRegistry/registries@2025-11-01' = {
  name: name
  location: location
  tags: tags
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: false
    // RBAC registry permissions (non-ABAC): the deploy identity's Contributor role can push,
    // and AcrPull lets each app identity pull (SPEC 10.1).
    roleAssignmentMode: 'LegacyRegistryPermissions'
    anonymousPullEnabled: false
    publicNetworkAccess: 'Enabled'
    zoneRedundancy: 'Disabled'
  }
}

resource pullIdentities 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' existing = [
  for identityName in pullIdentityNames: {
    name: identityName
  }
]

resource acrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = [
  for (identityName, i) in pullIdentityNames: {
    name: guid(registry.id, pullIdentities[i].id, acrPullRoleId)
    scope: registry
    properties: {
      roleDefinitionId: acrPullRoleId
      principalId: pullIdentities[i].properties.principalId
      principalType: 'ServicePrincipal'
    }
  }
]

output name string = registry.name
output loginServer string = registry.properties.loginServer
