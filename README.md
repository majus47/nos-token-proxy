# 🚗💨 nos-token-proxy

<div align="center">
  <img src="./assets/logo.png" alt="NOS Token Proxy" width="300"/>
  
  ⚡ NITROUS OXIDE SYSTEM FOR YOUR API CALLS ⚡  
  🏁 TURBOCHARGED PROXY WITH TOKEN ROTATION 🏁
</div>

A high-performance OpenAI-compatible API proxy server with automatic API key rotation, token usage tracking, and streaming support. Built for speed, reliability, and scalability.

## 🚀 Features

- **⚡ Lightning Fast**: Minimal latency proxy for OpenAI-compatible APIs
- **🔄 Auto Key Rotation**: Automatically rotates through multiple API keys
- **📊 Token Tracking**: Real-time token usage monitoring and logging
- **🌊 Streaming Support**: Full support for SSE streaming responses
- **🛡️ CORS Ready**: Built-in CORS handling for web applications
- **💪 High Throughput**: Configurable payload limits up to 50MB
- **🔧 TypeScript**: Fully typed with modular architecture
- **🎯 Drop-in Replacement**: Compatible with OpenAI API format

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/majus47/nos-token-proxy.git
cd nos-token-proxy

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Configure your environment (see below)
nano .env
```

## ⚙️ Configuration

Create a `.env` file in the root directory:

```env
# Target API URL (default: https://api.openai.com/v1)
TARGET_API_URL=https://api.openai.com/v1

# Multiple API keys for rotation (comma-separated)
API_KEYS=sk-key1,sk-key2,sk-key3,sk-key4

# Default model to use
MODEL=z-ai/glm-4.5-air:free

# Server port (default: 4015)
PORT=4015
```

### Environment Variables

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `TARGET_API_URL` | ✅ | The target API endpoint | `https://api.openai.com/v1` |
| `API_KEYS` | ✅ | Comma-separated list of API keys for rotation | - |
| `MODEL` | ✅ | Default model identifier | - |
| `PORT` | ❌ | Server port number | `4015` |

### Alternative Single Key Setup

For backward compatibility, you can use a single API key:

```env
API_KEY=your-single-api-key
```

## 🏁 Getting Started

```bash
# Start the server
npm run start

# Server will be running at http://localhost:4015
```

### Example Usage

Replace your OpenAI API calls with the proxy:

```javascript
// Before
const response = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'gpt-4',
    messages: [...]
  })
});

// After
const response = await fetch('http://localhost:4015/nos-proxy/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
    // No Authorization header needed!
  },
  body: JSON.stringify({
    model: 'gpt-4', // Will be automatically replaced with your configured model
    messages: [...],
    stream: true // Streaming supported!
  })
});
```

## 🏗️ Architecture

```
src/
├── app.ts                 # Main application entry point
├── types/
│   └── index.ts          # TypeScript interfaces
├── middleware/
│   └── cors.ts           # CORS handling
├── services/
│   ├── streamingService.ts    # Streaming request handler
│   └── nonStreamingService.ts # Non-streaming request handler
├── routes/
│   └── proxy.ts          # Main proxy route handler
├── utils/
│   └── tokenUsage.ts     # Token usage extraction and logging
└── config/
    └── server.ts         # Server configuration
```

## 📊 Token Usage Monitoring

The proxy automatically logs token usage for both streaming and non-streaming requests:

```
Token usage: 120 (prompt: 21, completion: 99)
Cached tokens: 20
```

## 🔄 API Key Rotation

Keys are rotated automatically on each request:

```
Using API key 1/4 (rotated)
Using API key 2/4 (rotated)
Using API key 3/4 (rotated)
Using API key 4/4 (rotated)
Using API key 1/4 (rotated) # Cycles back to first key
```

## 🛠️ Development

```bash
# Install dependencies
npm install

# Start development server with hot reload
npm run dev

# Build for production
npm run build

# Run linting
npm run lint
```

## 🐛 Troubleshooting

### PayloadTooLargeError

If you encounter "request entity too large" errors, the proxy is configured to handle up to 50MB payloads. You can adjust this in `src/app.ts`:

```typescript
app.use(express.json({ limit: '100mb' })); // Increase limit
```

### CORS Issues

The proxy includes comprehensive CORS handling. If you still encounter CORS issues, check that your client is making requests to the correct proxy endpoint.

### Streaming Not Working

Ensure your client properly handles Server-Sent Events (SSE) and that the `stream: true` parameter is included in your request body.

## 📝 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/nos-proxy/*` | `ALL` | Proxy any OpenAI-compatible endpoint |
| `/nos-proxy/chat/completions` | `POST` | Chat completions (most common) |
| `/nos-proxy/completions` | `POST` | Text completions |
| `/nos-proxy/embeddings` | `POST` | Text embeddings |

## 🚦 Performance Tips

1. **Use Multiple Keys**: Configure multiple API keys for better rate limit handling
2. **Enable Streaming**: Use `stream: true` for real-time responses
3. **Monitor Logs**: Keep an eye on token usage to optimize costs
4. **Load Balancing**: Run multiple proxy instances behind a load balancer for high availability

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 🙏 Acknowledgments

- Inspired by the NOS system from The Fast and the Furious franchise
- Built and prompted for the AI community with ❤️

---

**🏁 Ready to boost your API calls? Fire up the NOS Token Proxy and leave your rate limits in the dust! 🏁**