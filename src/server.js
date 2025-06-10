import dotenv from 'dotenv';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { URL } from 'url';

chalk.level = 2;

dotenv.config();

const log = {
  info: (msg) => console.error(`${chalk.cyan('\nℹ️  INFO')}: ${msg}`),
  success: (msg) => console.error(`${chalk.green('\n✓ SUCCESS')}: ${msg}`),
  error: (msg) => console.error(`${chalk.red('\n✗ ERROR')}: ${msg}`),
  warning: (msg) => console.error(`${chalk.yellow('\n⚠️  WARNING')}: ${msg}`),
  debug: (msg) => console.error(`${chalk.dim('\n🔍 DEBUG')}: ${msg}`),
  divider: () => console.error(chalk.magenta('═'.repeat(50))),
  header: (title) => {
    console.error(chalk.magenta('═'.repeat(50)));
    console.error(chalk.bold.cyan(title));
    console.error(chalk.magenta('═'.repeat(50)));
  },
  api: (method, url) => console.error(`${chalk.blue(method)} ${chalk.dim(url)}`)
};

let API_BASE_URL, API_DOCS_URL, API_KEY, API_USERNAME, API_PASSWORD;
let configLoadedFrom = 'default';

try {
  const mcpPath = path.resolve('.vscode/mcp.json');
  if (fs.existsSync(mcpPath)) {
    const mcpConfig = JSON.parse(fs.readFileSync(mcpPath, 'utf8'));
    const apiConfig = mcpConfig.servers?.['api-server']?.env || {};
    
    API_BASE_URL = apiConfig.API_BASE_URL;
    API_DOCS_URL = apiConfig.API_DOCS_URL;
    API_KEY = apiConfig.API_KEY;
    API_USERNAME = apiConfig.API_USERNAME;
    API_PASSWORD = apiConfig.API_PASSWORD;
    
    if (API_BASE_URL) {
      configLoadedFrom = 'mcp.json';
    }
  }
} catch (error) {
  log.error('Error reading from mcp.json:', error.message);
}

if (!API_BASE_URL) API_BASE_URL = process.env.API_BASE_URL;
if (!API_DOCS_URL) API_DOCS_URL = process.env.API_DOCS_URL;
if (!API_KEY) API_KEY = process.env.API_KEY;
if (!API_USERNAME) API_USERNAME = process.env.API_USERNAME;
if (!API_PASSWORD) API_PASSWORD = process.env.API_PASSWORD;

if (configLoadedFrom !== 'mcp.json' && process.env.API_BASE_URL) {
  configLoadedFrom = 'environment';
}

function maskSecret(secret) {
  if (!secret) return '[MISSING]';
  
  return secret.length > 4 
    ? secret.substring(0, 2) + '*'.repeat(secret.length - 4) + secret.slice(-2) 
    : '*'.repeat(secret.length);
}

log.header('Starting API Test MCP Server');

if (!API_BASE_URL) log.warning('API_BASE_URL not found in configuration');
if (configLoadedFrom === 'default') log.warning('Some API configuration values missing from mcp.json');

console.error(`${chalk.bold('Base URL:')} ${chalk.cyan(API_BASE_URL || '[MISSING]')}
${chalk.bold('Docs URL:')} ${chalk.cyan(API_DOCS_URL || '[NOT SET - Using auto-discovery]')}
${chalk.bold('API Key:')} ${chalk.cyan(API_KEY ? '[PRESENT]' : '[MISSING]')}
${chalk.bold('Source:')} ${chalk.cyan(configLoadedFrom)}
`);


const tools = [
  {
    name: "fetch_swagger_info",
    description: "Fetch Swagger/OpenAPI documentation to discover available API endpoints",
    inputSchema: {
      type: "object",
      properties: {
        url: { 
          type: "string", 
          description: "URL to the swagger.json or swagger.yaml file. If not provided, will try to use the base URL with common Swagger paths." 
        }
      },
      required: [],
    },
  },
  {
    name: "list_endpoints",
    description: "List all available API endpoints after fetching Swagger documentation",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "get_endpoint_details",
    description: "Get detailed information about a specific API endpoint",
    inputSchema: {
      type: "object",
      properties: {
        path: { 
          type: "string", 
          description: "The endpoint path to get details for (e.g., '/users/{id}')"
        },
        method: { 
          type: "string", 
          description: "The HTTP method (GET, POST, PUT, DELETE, etc.)" 
        }
      },
      required: ["path", "method"],
    },
  },
  {
    name: "execute_api_request",
    description: "Execute an API request to a specific endpoint",
    inputSchema: {
      type: "object",
      properties: {
        method: { 
          type: "string", 
          description: "HTTP method (GET, POST, PUT, DELETE, etc.)" 
        },
        path: { 
          type: "string", 
          description: "The endpoint path (e.g., '/users/123')" 
        },
        params: { 
          type: "object", 
          description: "Query parameters as key-value pairs"
        },
        body: { 
          type: "object", 
          description: "Request body as a JSON object (for POST/PUT/PATCH)"
        },
        headers: { 
          type: "object", 
          description: "Custom headers as key-value pairs"
        }
      },
      required: ["method", "path"],
    },
  },
  {
    name: "validate_api_response",
    description: "Validate an API response against the schema from Swagger documentation",
    inputSchema: {
      type: "object",
      properties: {
        path: { 
          type: "string", 
          description: "The endpoint path" 
        },
        method: { 
          type: "string", 
          description: "The HTTP method" 
        },
        statusCode: { 
          type: "number", 
          description: "The HTTP status code" 
        },
        responseBody: { 
          type: "object", 
          description: "The response body to validate"
        }
      },
      required: ["path", "method", "statusCode", "responseBody"],
    },
  }
];

const server = new Server(
  {
    name: "SwaggerMCP",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: tools.reduce((acc, tool) => ({ ...acc, [tool.name]: tool }), {}),
    },
  },
);

let swaggerDoc = null;
let swaggerUrl = null;

let authTokens = {
  swaggerAccess: API_KEY,
  apiAccess: null
};

function buildUrl(path, params = {}, baseUrl = API_BASE_URL) {
  if (!baseUrl) {
    throw new Error('No base URL available to build URL');
  }
  
  if (path.startsWith('http://') || path.startsWith('https://')) {
    try {
      const parsedUrl = new URL(path);
      path = parsedUrl.pathname + parsedUrl.search;
      log.warning(`Full URL detected in path: "${path}". Using only the path portion with configured API_BASE_URL.`);
    } catch (e) {
      log.warning(`Invalid URL format in path: ${path}`);
    }
  }
  
  const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const endpoint = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${base}${endpoint}`);
  
  if (params) {
    Object.keys(params).forEach(key => {
      url.searchParams.append(key, params[key]);
    });
  }
  
  return url.toString();
}

function getAuthHeader(forSwagger = false) {
  if (API_KEY && forSwagger) {
    return { 'Authorization': `Bearer ${API_KEY}` };
  } else if (API_USERNAME && API_PASSWORD) {
    return { 'Authorization': `Basic ${Buffer.from(`${API_USERNAME}:${API_PASSWORD}`).toString('base64')}` };
  }
  return {};
}

async function fetchSwaggerDoc(url = null) {
  try {
    if (url) {
      const isFullUrl = url.startsWith('http://') || url.startsWith('https://');
      let effectiveUrl = url;
      
      if (!isFullUrl && API_BASE_URL) {
        log.info(`Path-only URL provided, appending to API_BASE_URL`);
        effectiveUrl = buildUrl(url);
        log.api('GET', effectiveUrl);
      } else {
        log.api('GET', url);        
        try {
          const parsedUrl = new URL(url);
          const urlBase = `${parsedUrl.protocol}//${parsedUrl.host}`;
          
          if (API_BASE_URL && urlBase !== API_BASE_URL) {
            log.warning(`URL base ${urlBase} differs from configured API_BASE_URL ${API_BASE_URL}`);
            log.warning('This URL will be used for Swagger docs only, other operations will still use configured API_BASE_URL');
          }
        } catch (e) {
          log.warning(`Invalid URL format: ${url}`);
        }
      }
      
      const response = await fetch(effectiveUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          ...getAuthHeader(true)
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch Swagger doc: ${response.status} ${errorText}`);
      }
      
      const doc = await response.json();
      swaggerDoc = doc;
      swaggerUrl = effectiveUrl;
      
      log.success(`Successfully fetched Swagger documentation from ${effectiveUrl}`);
      
      return doc;
    }
    
    if (API_DOCS_URL) {
      log.info(`Trying to fetch Swagger doc from configured docs URL: ${API_DOCS_URL}`);
      try {
        const response = await fetch(API_DOCS_URL, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            ...getAuthHeader()
          }
        });
        
        if (response.ok) {
          const doc = await response.json();
          swaggerDoc = doc;
          swaggerUrl = API_DOCS_URL;
          
          log.success(`Successfully fetched Swagger documentation from ${API_DOCS_URL}`);
          
          return doc;
        } else {
          log.warning(`Failed to fetch from configured docs URL: ${response.status} ${response.statusText}`);
          
          // Try with .json extension if it doesn't have one
          if (!API_DOCS_URL.endsWith('.json')) {
            const jsonUrl = `${API_DOCS_URL}.json`;
            log.info(`Trying with .json extension: ${jsonUrl}`);
            const jsonResponse = await fetch(jsonUrl, {
              method: 'GET',
              headers: {
                'Accept': 'application/json',
                ...getAuthHeader()
              }
            });
            
            if (jsonResponse.ok) {
              const doc = await jsonResponse.json();
              swaggerDoc = doc;
              swaggerUrl = jsonUrl;
              
              log.success(`Successfully fetched Swagger documentation from ${jsonUrl}`);
              
              return doc;
            }
          }
        }
      } catch (error) {
        log.warning(`Error fetching from configured docs URL: ${error.message}`);
      }
    }
    
    if (!API_BASE_URL) {
      throw new Error('No API_BASE_URL configured and no explicit Swagger URL provided');
    }
    
    const commonPaths = [
      '/api-docs',
      '/api-docs.json',
      '/api-docs/swagger.json',
      '/api-docs/v1/swagger.json',
      '/swagger',
      '/swagger.json',
      '/swagger/v1/swagger.json',
      '/swagger-ui',
      '/swagger-ui.json',
      '/swagger-ui/swagger.json',
      '/openapi',
      '/openapi.json',
      '/docs',
      '/docs.json',
      '/docs/swagger.json'
    ];
    
    // Try each common path
    for (const path of commonPaths) {
      const testUrl = buildUrl(path);
      log.info(`Trying to fetch Swagger doc from: ${testUrl}`);
      
      try {
        const response = await fetch(testUrl, { 
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            ...getAuthHeader()
          }
        });
        
        if (response.ok) {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const doc = await response.json();
            swaggerDoc = doc;
            swaggerUrl = testUrl;
            
            log.success(`Successfully fetched Swagger documentation from ${testUrl}`);
            
            return doc;
          } else {
            log.info(`Found path ${testUrl} but content type is not JSON: ${contentType}`);
          }
        }
      } catch (e) {
        log.debug(`Failed to fetch from ${testUrl}: ${e.message}`);
      }
    }
    
    throw new Error('Could not find Swagger documentation at any common paths. Please provide explicit URL.');
  } catch (error) {
    log.error(`Error fetching Swagger documentation: ${error.message}`);
    throw new Error(`Failed to fetch Swagger documentation: ${error.message}`);
  }
}

function listEndpoints() {
  if (!swaggerDoc) {
    throw new Error('Swagger documentation not loaded. Call fetch_swagger_info first.');
  }
  
  const endpoints = [];
  const paths = swaggerDoc.paths || {};
  
  for (const path in paths) {
    const methods = Object.keys(paths[path]).filter(key => 
      ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].includes(key.toLowerCase())
    );
    
    methods.forEach(method => {
      const operation = paths[path][method];
      
      endpoints.push({
        path,
        method: method.toUpperCase(),
        summary: operation.summary || '',
        operationId: operation.operationId || '',
        tags: operation.tags || []
      });
    });
  }
  
  return endpoints;
}

function getEndpointDetails(path, method) {
  if (!swaggerDoc) {
    throw new Error('Swagger documentation not loaded. Call fetch_swagger_info first.');
  }
  
  const paths = swaggerDoc.paths || {};
  method = method.toLowerCase();
  
  if (!paths[path] || !paths[path][method]) {
    throw new Error(`Endpoint ${method.toUpperCase()} ${path} not found in the Swagger documentation`);
  }
  
  const endpoint = paths[path][method];
  const parameters = endpoint.parameters || [];
  const responses = endpoint.responses || {};
  
  const formattedResponses = {};
  for (const statusCode in responses) {
    formattedResponses[statusCode] = {
      description: responses[statusCode].description || '',
      schema: responses[statusCode].schema || null,
      examples: responses[statusCode].examples || null
    };
  }
  
  return {
    summary: endpoint.summary || '',
    description: endpoint.description || '',
    operationId: endpoint.operationId || '',
    parameters,
    requestBody: endpoint.requestBody || null,
    responses: formattedResponses,
    consumes: endpoint.consumes || swaggerDoc.consumes || ['application/json'],
    produces: endpoint.produces || swaggerDoc.produces || ['application/json']
  };
}

async function executeApiRequest(method, path, params = {}, body = null, headers = {}) {
  try {
    const url = buildUrl(path, params);
    const requestOptions = {
      method: method.toUpperCase(),
      headers: {
        'Accept': 'application/json',
        ...headers
      }
    };
    
    if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()) && body) {
      requestOptions.headers['Content-Type'] = 'application/json';
      requestOptions.body = JSON.stringify(body);
    }
    
    const isAuthEndpoint = isAuthenticationEndpoint(path);
    
    if (isAuthEndpoint) {
      log.info(`Auth endpoint detected: ${path}. Not adding Authorization header.`);
      
      if (!body && ['POST', 'PUT'].includes(method.toUpperCase()) && API_USERNAME && API_PASSWORD) {
        const isSignUp = isSignUpEndpoint(path);
        
        if (!isSignUp) {
          requestOptions.headers['Content-Type'] = 'application/json';
          requestOptions.body = JSON.stringify({
            username: API_USERNAME,
            password: API_PASSWORD
          });
          log.info(`Auto-injecting default credentials for authentication endpoint`);
        } else {
          log.warning(`Sign-up/register endpoint detected: ${path}. Skipping auto-injection of default credentials. Use unique credentials for registration.`);
        }
      }
    } else {
      if (!headers.Authorization) {
        if (authTokens.apiAccess) {
          requestOptions.headers['Authorization'] = `Bearer ${authTokens.apiAccess}`;
          log.info(`Using stored API token for authorization`);
        } 
        else if (API_KEY) {
          requestOptions.headers['Authorization'] = `Bearer ${API_KEY}`;
          log.info(`Using configured API key for authorization`);
        }
      }
    }
    
    log.api(method.toUpperCase(), url);
    
    log.debug(`Request headers: ${JSON.stringify(maskSensitiveHeaders(requestOptions.headers))}`);
    if (requestOptions.body) {
      const logBody = JSON.parse(requestOptions.body);
      const sensitiveFields = ['password', 'secret', 'token', 'key', 'apiKey', 'api_key'];
      for (const field of sensitiveFields) {
        if (field in logBody) {
          logBody[field] = '********';
        }
      }
      log.debug(`Request body: ${JSON.stringify(logBody, null, 2)}`);
    }
    
    const response = await fetch(url, requestOptions);
    
    if (response.status === 401 && !isAuthEndpoint) {
      log.warning(`Received 401 Unauthorized. Attempting to refresh token...`);
      
      if (swaggerDoc) {
        const authEndpoint = findAuthEndpoint();
        
        if (authEndpoint) {
          log.info(`Found auth endpoint: ${authEndpoint.method} ${authEndpoint.path}`);
          
          const authResponse = await executeApiRequest(
            authEndpoint.method,
            authEndpoint.path,
            {},
            { username: API_USERNAME, password: API_PASSWORD },
            {}
          );
          
          if (authResponse.status >= 200 && authResponse.status < 300) {
            log.success(`Successfully refreshed token`);
            
            if (authTokens.apiAccess) {
              requestOptions.headers['Authorization'] = `Bearer ${authTokens.apiAccess}`;
              log.info(`Retrying request with new token`);
              
              const retryResponse = await fetch(url, requestOptions);
              return await processApiResponse(retryResponse, path, url, method);
            }
          }
        } else {
          log.warning(`Could not find suitable auth endpoint to refresh token`);
        }
      }
    }
    
    return await processApiResponse(response, path, url, method);
  } catch (error) {
    log.error(`Error executing API request: ${error.message}`);
    throw new Error(`API request failed: ${error.message}`);
  }
}

async function processApiResponse(response, path, url, method) {
  let responseBody;
  const contentType = response.headers.get('content-type');
  
  if (contentType && contentType.includes('application/json')) {
    responseBody = await response.json();
    
    if (response.ok && isAuthenticationEndpoint(path)) {
      storeAuthTokenFromResponse(responseBody, path);
    }
  } else {
    responseBody = await response.text();
  }
  
  log.debug(`Response status: ${response.status}`);
  log.debug(`Response headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()))}`);
  
  if (typeof responseBody === 'object') {
    log.debug(`Response body: ${JSON.stringify(responseBody, null, 2)}`);
  } else if (responseBody) {
    log.debug(`Response body: ${responseBody}`);
  }
  
  const apiResponse = {
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers.entries()),
    body: responseBody,
    requestUrl: url,
    requestMethod: method.toUpperCase()
  };
  
  if (response.ok) {
    log.success(`API call successful: ${response.status} ${response.statusText}`);
  } else {
    const errorMessage = typeof responseBody === 'object' 
      ? JSON.stringify(responseBody, null, 2) 
      : responseBody;
    
    log.error(`API call failed: ${response.status} ${response.statusText}`);
    log.error(`Error details: ${errorMessage}`);
  }
  
  return apiResponse;
}

function findAuthEndpoint() {
  if (!swaggerDoc || !swaggerDoc.paths) return null;
  
  const authPaths = [
    { pattern: '/auth/login', methods: ['post'] },
    { pattern: '/auth/signin', methods: ['post'] },
    { pattern: '/auth/sign-in', methods: ['post'] },
    { pattern: '/login', methods: ['post'] },
    { pattern: '/signin', methods: ['post'] },
    { pattern: '/sign-in', methods: ['post'] },
    { pattern: '/token', methods: ['post'] },
    { pattern: '/auth/token', methods: ['post'] },
    { pattern: '/oauth/token', methods: ['post'] }
  ];
  
  for (const { pattern, methods } of authPaths) {
    if (swaggerDoc.paths[pattern]) {
      for (const method of methods) {
        if (swaggerDoc.paths[pattern][method]) {
          return { path: pattern, method: method };
        }
      }
    }
    
    for (const path in swaggerDoc.paths) {
      if (path.includes(pattern.replace(/^\//, ''))) {
        for (const method of methods) {
          if (swaggerDoc.paths[path][method]) {
            return { path, method };
          }
        }
      }
    }
  }
  
  return null;
}

function maskSensitiveHeaders(headers) {
  const maskedHeaders = { ...headers };
  if (maskedHeaders.Authorization) {
    if (maskedHeaders.Authorization.startsWith('Bearer ')) {
      maskedHeaders.Authorization = 'Bearer [MASKED]';
    } else if (maskedHeaders.Authorization.startsWith('Basic ')) {
      maskedHeaders.Authorization = 'Basic [MASKED]';
    } else {
      maskedHeaders.Authorization = '[MASKED]';
    }
  }
  return maskedHeaders;
}

function determineAuthHeader(path, method) {
  if (!swaggerDoc) {
    return getAuthHeader();
  }
  
  try {
    method = method.toLowerCase();
    
    let securityRequirements = [];
    if (swaggerDoc.paths && 
        swaggerDoc.paths[path] && 
        swaggerDoc.paths[path][method] &&
        swaggerDoc.paths[path][method].security) {
      securityRequirements = swaggerDoc.paths[path][method].security;
    } 
    else if (swaggerDoc.security) {
      securityRequirements = swaggerDoc.security;
    }
    
    if (securityRequirements.length > 0) {
      for (const secReq of securityRequirements) {
        // Get the first security scheme name
        const securitySchemeName = Object.keys(secReq)[0];
        if (!securitySchemeName) continue;
        
        // Find the security scheme definition
        const securitySchemes = swaggerDoc.components?.securitySchemes;
        if (!securitySchemes || !securitySchemes[securitySchemeName]) continue;
        
        const scheme = securitySchemes[securitySchemeName];
        
        // Handle different security schemes
        switch (scheme.type) {
          case 'http':
            if (scheme.scheme === 'bearer') {
              if (API_KEY) {
                return { 'Authorization': `Bearer ${API_KEY}` };
              }
            } else if (scheme.scheme === 'basic') {
              if (API_USERNAME && API_PASSWORD) {
                return { 'Authorization': `Basic ${Buffer.from(`${API_USERNAME}:${API_PASSWORD}`).toString('base64')}` };
              }
            }
            break;
          case 'apiKey':
            if (scheme.in === 'header' && API_KEY) {
              return { [scheme.name]: API_KEY };
            }
            break;
          // OAuth2 and other schemes could be added here
        }
      }
    }
    
    // If we couldn't determine auth from swagger, fall back to config
    return getAuthHeader();
  } catch (error) {
    log.warning(`Error determining auth header: ${error.message}`);
    return getAuthHeader();
  }
}

function storeAuthTokenFromResponse(response, path) {
  if (typeof response !== 'object' || response === null) {
    return;
  }

  const tokenFieldNames = [
    'accessToken', 'access_token', 'token', 'id_token', 
    'jwt', 'auth_token', 'api_key', 'apiKey'
  ];
  
  const isAuthPath = isAuthenticationEndpoint(path);
  
  if (isAuthPath) {
    // First check for direct token property
    for (const fieldName of tokenFieldNames) {
      if (response[fieldName] && typeof response[fieldName] === 'string') {
        // Store as API access token (not swagger token)
        authTokens.apiAccess = response[fieldName];
        log.success(`Successfully stored API authentication token from field '${fieldName}'`);
        return;
      }
    }
    
    // Handle nested token structures (e.g., { data: { token: '...' } })
    if (response.data && typeof response.data === 'object') {
      for (const fieldName of tokenFieldNames) {
        if (response.data[fieldName] && typeof response.data[fieldName] === 'string') {
          // Store as API access token (not swagger token)
          authTokens.apiAccess = response.data[fieldName];
          log.success(`Successfully stored API authentication token from nested field 'data.${fieldName}'`);
          return;
        }
      }
    }

    // Check for the token in the common structure where it's in the 'body' property
    if (response.body && typeof response.body === 'object') {
      for (const fieldName of tokenFieldNames) {
        if (response.body[fieldName] && typeof response.body[fieldName] === 'string') {
          // Store as API access token (not swagger token)
          authTokens.apiAccess = response.body[fieldName];
          log.success(`Successfully stored API authentication token from nested field 'body.${fieldName}'`);
          return;
        }
      }
    }
  }
}

function isAuthenticationEndpoint(path) {
  const authPatterns = [
    /\/auth\/?/i,
    /\/login\/?/i,
    /\/signin\/?/i,
    /\/sign-in\/?/i,
    /\/signup\/?/i,
    /\/sign-up\/?/i,
    /\/token\/?/i,
    /\/authorize\/?/i,
    /\/oauth\/?/i,
    /\/register\/?/i
  ];
  
  for (const pattern of authPatterns) {
    if (pattern.test(path)) {
      if (/\/auth\/users\/?$/i.test(path) || 
          /\/auth\/users\/\d+\/?$/i.test(path) ||
          /\/auth\/profile\/?$/i.test(path)) {
        return false;
      }
      return true;
    }
  }
  
  return false;
}

function isSignUpEndpoint(path) {
  const signUpPatterns = [
    /\/signup\/?$/i,
    /\/sign-up\/?$/i,
    /\/register\/?$/i,
    /\/auth\/signup\/?$/i,
    /\/auth\/sign-up\/?$/i,
    /\/auth\/register\/?$/i,
    /\/user\/create\/?$/i,
    /\/users\/create\/?$/i,
    /\/account\/create\/?$/i
  ];
  
  return signUpPatterns.some(pattern => pattern.test(path));
}

function validateApiResponse(path, method, statusCode, responseBody) {
  if (!path) {
    throw new Error('Path is required for API response validation');
  }
  if (!method) {
    throw new Error('Method is required for API response validation');
  }
  if (statusCode === undefined || statusCode === null) {
    throw new Error('Status code is required for API response validation');
  }
  if (responseBody === undefined) {
    throw new Error('Response body is required for API response validation');
  }
  
  if (!swaggerDoc) {
    throw new Error('Swagger documentation not loaded. Call fetch_swagger_info first.');
  }
  
  try {
    const endpoints = swaggerDoc.paths || {};
    method = method.toLowerCase();
    
    if (!endpoints[path] || !endpoints[path][method]) {
      throw new Error(`Endpoint ${method.toUpperCase()} ${path} not found in the Swagger documentation`);
    }
    
    const endpoint = endpoints[path][method];
    const responses = endpoint.responses || {};
    const responseSpec = responses[statusCode] || responses['default'];
    
    if (!responseSpec) {
      return {
        valid: false,
        errors: [`No schema defined for status code ${statusCode} in Swagger documentation`]
      };
    }
    

    const issues = [];
    
    if (responseSpec.schema) {
      try {
        if (responseSpec.schema.type === 'object' && typeof responseBody !== 'object') {
          issues.push(`Expected response to be an object, but got ${typeof responseBody}`);
        } else if (responseSpec.schema.type === 'array' && !Array.isArray(responseBody)) {
          issues.push(`Expected response to be an array, but got ${typeof responseBody}`);
        }
        
        issues.push('Note: Full schema validation requires a JSON Schema validator library');
      } catch (schemaError) {
        issues.push(`Schema validation error: ${schemaError.message}`);
      }
    }
    
    return {
      valid: issues.length === 0,
      errors: issues,
      schema: responseSpec.schema || null,
      expectedStatusCodes: Object.keys(responses),
      actualStatusCode: statusCode,
      responseSpec: responseSpec
    };
  } catch (error) {
    log.error(`Error validating API response: ${error.message}`);
    throw new Error(`Response validation failed: ${error.message}`);
  }
}
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  log.info(`Handling tool call: ${request.params.name}`);
  
  switch (request.params.name) {
    case "fetch_swagger_info": {
      const url = request.params.arguments?.url;
      
      try {
        const result = await fetchSwaggerDoc(API_DOCS_URL || url);
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify({
              title: result.info?.title || 'API Documentation',
              version: result.info?.version || 'Unknown',
              description: result.info?.description || 'No description available',
              swaggerVersion: result.swagger || result.openapi || 'Unknown',
              servers: result.servers || [{ url: API_BASE_URL }],
              pathCount: Object.keys(result.paths || {}).length,
              tagCount: (result.tags || []).length,
              docsUrl: swaggerUrl
            })
          }],
          isError: false,
        };
      } catch (error) {
        throw new Error(`Failed to fetch Swagger info: ${error.message}`);
      }
    }

    case "list_endpoints": {
      try {
        if (!swaggerDoc) {
          throw new Error('Swagger documentation not loaded. Call fetch_swagger_info first.');
        }
        
        const endpoints = listEndpoints();
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify(endpoints)
          }],
          isError: false,
        };
      } catch (error) {
        throw new Error(`Failed to list endpoints: ${error.message}`);
      }
    }

    case "get_endpoint_details": {
      const path = request.params.arguments?.path;
      const method = request.params.arguments?.method;
      
      if (!path || !method) {
        throw new Error("Both path and method are required");
      }

      try {
        const details = getEndpointDetails(path, method);
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify(details)
          }],
          isError: false,
        };
      } catch (error) {
        throw new Error(`Failed to get endpoint details: ${error.message}`);
      }
    }

    case "execute_api_request": {
      const method = request.params.arguments?.method;
      const path = request.params.arguments?.path;
      const params = request.params.arguments?.params || {};
      const body = request.params.arguments?.body || null;
      const headers = request.params.arguments?.headers || {};
      
      if (!method || !path) {
        throw new Error("Method and path are required");
      }

      try {
        const result = await executeApiRequest(method, path, params, body, headers);
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify(result)
          }],
          isError: false,
        };
      } catch (error) {
        throw new Error(`Failed to execute API request: ${error.message}`);
      }
    }

    case "validate_api_response": {
      const path = request.params.arguments?.path;
      const method = request.params.arguments?.method;
      const statusCode = request.params.arguments?.statusCode;
      const responseBody = request.params.arguments?.responseBody;
      
      const missingParams = [];
      if (!path) missingParams.push('path');
      if (!method) missingParams.push('method');
      if (statusCode === undefined) missingParams.push('statusCode');
      if (responseBody === undefined) missingParams.push('responseBody');
      
      if (missingParams.length > 0) {
        const errorMessage = `Missing required parameters for API response validation: ${missingParams.join(', ')}`;
        log.error(errorMessage);
        throw new Error(errorMessage);
      }

      try {
        log.info(`Validating response for ${method.toUpperCase()} ${path} with status ${statusCode}`);
        let parsedBody = responseBody;
        if (typeof responseBody === 'string') {
          try {
            parsedBody = JSON.parse(responseBody);
            log.info('Successfully parsed response body string as JSON');
          } catch (parseError) {
            log.warning(`Response body is a string but not valid JSON: ${parseError.message}`);
          }
        }
        
        const result = validateApiResponse(path, method, statusCode, parsedBody);
        
        if (result.valid) {
          log.success('Response validation passed');
        } else {
          log.warning(`Response validation found ${result.errors.length} issues`);
          result.errors.forEach(error => log.debug(`Validation issue: ${error}`));
        }
        
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify(result)
          }],
          isError: false,
        };
      } catch (error) {
        log.error(`Failed to validate API response: ${error.message}`);
        throw new Error(`Failed to validate API response: ${error.message}`);
      }
    }

    default:
      throw new Error(`Unknown tool: ${request.params.name}`);
  }
});

async function runServer() {
  try {
    if (API_BASE_URL || API_DOCS_URL) {
      try {
        const docsSource = API_DOCS_URL ? 'API_DOCS_URL' : 'API_BASE_URL';
        log.info(`Attempting to fetch Swagger documentation using ${docsSource}`);
        await fetchSwaggerDoc();
      } catch (error) {
        log.warning(`Could not automatically fetch Swagger documentation: ${error.message}`);
        log.info('The AI will need to explicitly call fetch_swagger_info with the correct URL');
      }
    } else {
      log.warning('No API_BASE_URL or API_DOCS_URL configured. The AI will need to provide a URL to fetch_swagger_info');
    }
    
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    log.success("API Test Server successfully started");
  } catch (error) {
    log.error("Failed to initialize:", error);
    process.exit(1);
  }
}

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

runServer().catch((error) => {
  console.error("Server startup error:", error);
  process.exit(1);
});
