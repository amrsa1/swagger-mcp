# Swagger MCP Server

A Model Context Protocol (MCP) server that provides tools for exploring and testing APIs through Swagger/OpenAPI documentation. This server automatically detects configuration files from multiple IDEs and provides comprehensive API interaction capabilities.

## Features

- 🔍 **Fetch and parse Swagger/OpenAPI documentation** from any URL
- 🧪 **Test API endpoints** directly through the MCP interface  
- 📊 **Explore API schemas** and understand data structures
- 🔧 **Multi-IDE support** - automatically detects config from VS Code, Cursor, Windsurf, and more
- 🌐 **Flexible authentication** - supports API keys, basic auth, and bearer tokens
- ⚡ **Auto-discovery** - can find documentation URLs automatically

## Configuration

### IDE Setup

Create an MCP configuration file in your IDE's configuration directory:

- **VS Code**: `~/.vscode/mcp.json` or `.vscode/mcp.json` (in your project)
- **Cursor**: `~/.cursor/mcp.json` or `.cursor/mcp.json` (in your project)  
- **Windsurf**: `~/.windsurf/mcp.json` or `.windsurf/mcp.json` (in your project)
- **Any IDE**: `mcp.json` (in your project root) or `.mcp/config.json`

### Authentication Options

#### Option 1: Using API Key

```json
"swagger-mcp": {
  "command": "npx",
  "args": [
    "-y",
    "swagger-mcp@latest"
  ],
  "env": {
    "API_BASE_URL": "https://api.example.com",
    "API_DOCS_URL": "https://api.example.com/swagger.json",
    "API_KEY": "your-api-key-here"
  }
}
```

#### Option 2: Using Username and Password

```json
"swagger-mcp": {
  "command": "npx",
  "args": [
    "-y", 
    "swagger-mcp@latest"
  ],
  "env": {
    "API_BASE_URL": "https://api.example.com",
    "API_DOCS_URL": "https://api.example.com/swagger.json",
    "API_USERNAME": "your-username",
    "API_PASSWORD": "your-password"
  }
}
```

## Configuration Options

- `API_BASE_URL` - Base URL for your API (e.g., `https://api.example.com`) **[Required]**
- `API_DOCS_URL` - Direct URL to Swagger/OpenAPI JSON/YAML (optional, will be auto-discovered)
- `API_KEY` - API key for authentication (used as Bearer token)
- `API_USERNAME` - Username for basic authentication
- `API_PASSWORD` - Password for basic authentication

## Authentication Flow

The server intelligently handles authentication:

1. **For API requests**: Uses API_KEY as Bearer token, falls back to Basic auth
2. **For authentication endpoints**: Auto-injects username/password credentials
3. **Token management**: Automatically stores and reuses tokens from login responses
4. **Auto-refresh**: Attempts to refresh tokens on 401 Unauthorized responses

## Available Tools

### `fetch_swagger_info`
Fetches and parses Swagger/OpenAPI documentation from a given URL to discover available API endpoints.

### `list_endpoints`
Lists all available API endpoints after fetching Swagger documentation, showing methods, paths, and summaries.

### `get_endpoint_details`
Gets detailed information about a specific API endpoint including parameters, request/response schemas, and examples.

### `execute_api_request`
Executes an API request to a specific endpoint with authentication, parameters, headers, and body handling.

### `validate_api_response`
Validates an API response against the schema definitions from Swagger documentation to ensure compliance.

## Usage Examples

Once configured, you can use the MCP server in your AI-powered editor to:

- **Explore APIs**: "Show me the available endpoints in this API"
- **Test endpoints**: "Test the POST /users endpoint with this data"
- **Understand schemas**: "Explain the User model structure"
- **Debug API calls**: "Help me troubleshoot this API request"
- **Validate responses**: "Check if this response matches the API schema"

## Supported IDEs

The server automatically detects configuration files from:
- **VS Code** (`.vscode/mcp.json`)
- **Cursor** (`.cursor/mcp.json`)
- **Windsurf** (`.windsurf/mcp.json`)
- **Root directory** (`mcp.json`)
- **Alternative location** (`.mcp/config.json`)

## Development

```bash
# Clone the repository
git clone https://github.com/amrsa1/SwaggerMCP.git
cd SwaggerMCP

# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build
```

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
