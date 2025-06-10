# Swagger MCP Server

A Model Context Protocol (MCP) server that provides tools for exploring and testing APIs through Swagger/OpenAPI documentation.

## Features

- 🔍 **Auto-discovery**: Automatically finds Swagger/OpenAPI documentation from common paths
- 🎯 **Multi-IDE Support**: Works with VS Code, Cursor, Windsurf, and other MCP-compatible editors
- 🔧 **API Testing**: Execute API requests directly from your editor
- 📋 **Schema Validation**: Validate API responses against Swagger schemas
- 🔐 **Authentication**: Supports Bearer tokens, Basic auth, and API keys
- ⚡ **Smart Config**: Automatically detects configuration from multiple sources

## Installation

Install globally via npm:

```bash
npm install -g swagger-mcp
```

## Configuration

### VS Code

Add to your VS Code settings (`~/.vscode/mcp.json` or `.vscode/mcp.json` in your project):

```json
{
  "mcpServers": {
    "swagger-mcp": {
      "command": "swagger-mcp",
      "env": {
        "API_BASE_URL": "https://api.example.com",
        "API_DOCS_URL": "https://api.example.com/swagger.json",
        "API_KEY": "your-api-key"
      }
    }
  }
}
```

### Cursor

Add to your Cursor settings (`~/.cursor/mcp.json` or `.cursor/mcp.json` in your project):

```json
{
  "mcpServers": {
    "swagger-mcp": {
      "command": "swagger-mcp",
      "env": {
        "API_BASE_URL": "https://api.example.com",
        "API_DOCS_URL": "https://api.example.com/swagger.json",
        "API_KEY": "your-api-key"
      }
    }
  }
}
```

### Windsurf

Add to your Windsurf settings (`~/.windsurf/mcp.json` or `.windsurf/mcp.json` in your project):

```json
{
  "mcpServers": {
    "swagger-mcp": {
      "command": "swagger-mcp",
      "env": {
        "API_BASE_URL": "https://api.example.com",
        "API_DOCS_URL": "https://api.example.com/swagger.json",
        "API_KEY": "your-api-key"
      }
    }
  }
}
```

## Configuration Options

- `API_BASE_URL`: Base URL for your API (required)
- `API_DOCS_URL`: Direct URL to Swagger/OpenAPI JSON (optional - will auto-discover if not provided)
- `API_KEY`: API key for authentication (optional)
- `API_USERNAME`: Username for Basic authentication (optional)
- `API_PASSWORD`: Password for Basic authentication (optional)

## Available Tools

### 1. fetch_swagger_info
Fetches and parses Swagger/OpenAPI documentation.

### 2. list_endpoints
Lists all available API endpoints from the Swagger documentation.

### 3. get_endpoint_details
Gets detailed information about a specific endpoint.

### 4. execute_api_request
Executes an API request to a specific endpoint.

### 5. validate_api_response
Validates an API response against the Swagger schema.

## License

MIT License - see [LICENSE](LICENSE) file for details.
