import OpenAI from 'openai';

// Configure the OpenAI client to use your proxy
const openai = new OpenAI({
  apiKey: 'your-api-key-here', // This will be replaced by your proxy
  baseURL: 'http://localhost:4015', // Your proxy server URL
});

async function testStreaming() {
  console.log('🚀 Testing streaming chat completion...\n');
  
  try {
    const stream = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo', // This will be replaced by your proxy with "z-ai/glm-4.5-air:free"
      messages: [
        {
          role: 'user',
          content: 'Write a short poem about coding. Make it at least 4 lines long.'
        }
      ],
      stream: true, // Enable streaming
      max_tokens: 150,
    });

    console.log('📡 Streaming response:');
    console.log('-------------------');
    
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        console.log(content)
        process.stdout.write(content); // Print without newline to see streaming effect
      }
    }
    
    console.log('\n-------------------');
    console.log('✅ Streaming completed successfully!\n');
    
  } catch (error) {
    console.error('❌ Error during streaming:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

async function testNonStreaming() {
  console.log('🔄 Testing non-streaming chat completion...\n');
  
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo', // This will be replaced by your proxy
      messages: [
        {
          role: 'user',
          content: 'Say hello in exactly 10 words.'
        }
      ],
      stream: false, // Disable streaming
      max_tokens: 50,
    });

    console.log('📝 Non-streaming response:');
    console.log('-------------------------');
    console.log(JSON.stringify(response));
    console.log('-------------------------');
    console.log('✅ Non-streaming completed successfully!\n');
    
  } catch (error) {
    console.error('❌ Error during non-streaming:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

async function runTests() {
  console.log('🧪 OpenAI Proxy Test Suite');
  console.log('===========================\n');
  
  // Test both streaming and non-streaming
  await testStreaming();
 //await testNonStreaming();
  
  console.log('🎉 All tests completed!');
}

// Run the tests
runTests().catch(console.error);