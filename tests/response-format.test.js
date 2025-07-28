const AIService = require('/home/runner/work/zhimo-restructure/zhimo-restructure/src/services/AIService');

// Mock OpenAI module to capture the API calls
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: '{"test": "response"}' } }]
        })
      }
    }
  }));
});

describe('AIService response_format parameter', () => {
  let aiService;
  let mockOpenAI;

  beforeEach(() => {
    // Set up environment variables for testing
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.OPENAI_MODEL = 'gpt-4';
    
    aiService = new AIService();
    mockOpenAI = aiService.openai.chat.completions.create;
    mockOpenAI.mockClear();
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;
  });

  test('generateExercises should include response_format parameter', async () => {
    // Mock specific response for generateExercises
    mockOpenAI.mockResolvedValue({
      choices: [{ message: { content: '{"exercises": []}' } }]
    });

    const testContent = 'Test content for exercises';
    const testTitle = 'Test Title';
    
    await aiService.generateExercises(testContent, testTitle, { saveToDatabase: false });

    expect(mockOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({
        response_format: { type: "json_object" }
      })
    );
  });

  test('extractConcepts should include response_format parameter', async () => {
    // Mock specific response for extractConcepts
    mockOpenAI.mockResolvedValue({
      choices: [{ message: { content: '{"concepts": []}' } }]
    });

    const testContent = 'Test content for concepts';
    
    await aiService.extractConcepts(testContent);

    expect(mockOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({
        response_format: { type: "json_object" }
      })
    );
  });

  test('generateMindMap should include response_format parameter', async () => {
    // Mock specific response for generateMindMap
    mockOpenAI.mockResolvedValue({
      choices: [{ message: { content: '{"title": "Test", "mermaid": "mindmap\\n  root"}' } }]
    });

    const testContent = 'Test content for mind map';
    
    await aiService.generateMindMap(testContent, { saveToDatabase: false });

    expect(mockOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({
        response_format: { type: "json_object" }
      })
    );
  });

  test('restructureDocument should NOT include response_format parameter', async () => {
    // Mock response for restructureDocument (markdown format)
    mockOpenAI.mockResolvedValue({
      choices: [{ message: { content: '# Restructured Document\n\nContent here' } }]
    });

    const testContent = 'Test content for restructuring';
    
    await aiService.restructureDocument(testContent);

    expect(mockOpenAI).toHaveBeenCalledWith(
      expect.not.objectContaining({
        response_format: expect.anything()
      })
    );
  });

  test('generateSummary should NOT include response_format parameter', async () => {
    // Mock response for generateSummary (markdown format)
    mockOpenAI.mockResolvedValue({
      choices: [{ message: { content: '## Summary\n\nThis is a summary' } }]
    });

    const testContent = 'Test content for summary';
    
    await aiService.generateSummary(testContent);

    expect(mockOpenAI).toHaveBeenCalledWith(
      expect.not.objectContaining({
        response_format: expect.anything()
      })
    );
  });
});