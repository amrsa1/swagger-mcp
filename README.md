# Swagger MCP Server

A Model Context Protocol (MCP) server that provides tools for exploring and testing APIs through Swagger/OpenAPI documentation.

## Features

- 🔍 **Auto-discovery**: Automatically finds Swagger/OpenAPI documentation from common paths
- 📚 **Documentation Parsing**: Fetches and parses Swagger/OpenAPI specs
- ��️ **API Testing**: Execute API requests with automatic authentication handling
- ✅ **Response Validation**: Validate API responses against Swagger schemas
- 🔐 **Authentication Support**: Multiple auth methods (Bearer tokens, Basic auth, API keys)
- 🎨 **Rich Logging**: Colorful, informative logging for debugging
- 🔮 **Multi-IDE Support**: Works with VS Code, Cursor, Windsurf, and other MCP-compatible editors

## Installation

```bash
npm install -g swagger-mcp
```

## Configuration

### VS Code / Cursor / Windsurf Configuration

Add the following to your IDE's MCP configuration:

```json
{
  "mcp": {
    "servers": {
      "swagger-mcp": {
        "command": "npx",
        "args": ["-y", "swagger-mcp"],
        "env": {
          "API_BASE_URL": "https://your-api.com",
          "API_DOCS_URL": "https://your-api.com/swagger.json",
          "API_KEY": "your-api-key",
          "API_USERNAME": "your-username",
          "API_PASSWORD": "your-password"
        }
      }
    }
  }
}
```

### Local MCP Configuration

The server automatically detects MCP configuration files from multiple IDEs:

- `.vscode/mcp.json` (VS Code)
- `.cursor/mcp.json` (Cursor)
- `.windsurf/mcp.json` (Windsurf)
- `mcp.json` (Root directory)
- `.mcp/config.json` (Alternative location)

Example configuration:

```json
{
  "servers": {
    "swagger-mcp": {
      "env": {
        "API_BASE_URL": "http://localhost:3022",
        "API_DOCS_URL": "http://localhost:3022/swagger.json",
        "API_KEY": "your-api-key",
        "API_USERNAME": "your-username",
        "API_PASSWORD": "your-password"
      }
    }
  }
}
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| API_BASE_URL | Base URL of your API | Yes |
| API_DOCS_URL | Direct URL to Swagger/OpenAPI documentation | No* |
| API_KEY | API key for authentication | No |
| API_USERNAME | Username for basic authentication | No |
| API_PASSWORD | Password for basic authentication | No |

*If API_DOCS_URL is not provided, the server will attempt to auto-discover documentation using common paths.

## Available Tools

### 1. fetch_swagger_info

Fetches and parses Swagger/OpenAPI documentation.

### 2. list_endpoints

Lists all available API endpoints from the loaded documentation.

### 3. get_endpoint_details

Gets detailed information about a specific endpoint.

### 4. execute_api_request

Executes an API request with automatic authentication.

### 5. validate_api_response

Validates an API response against the Swagger schema.

## Authentication

The server supports multiple authentication methods:

1. **Bearer Token**: Set API_KEY environment variable
2. **Basic Authentication**: Set API_USERNAME and API_PASSWORD
3. **Automatic Token Management**: Automatically handles auth endpoints and token refresh

## Auto-Discovery

If you only provide API_BASE_URL, the server will attempt to find Swagger documentation at common paths:

- /api-docs, /swagger.json, /openapi.json, /docs, and many more...

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

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

If you encounter any issues or have questions, please [open an issue](https://github.com/amrsa1/SwaggerMCP/issues) on GitHub.
