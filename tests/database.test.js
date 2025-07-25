const mongoose = require('mongoose');
const databaseConnection = require('../src/utils/database');
const { initializeDatabase, cleanTestData } = require('../src/utils/initDatabase');
const models = require('../src/models');

describe('Database Connection and Models', () => {
  beforeAll(async () => {
    // 设置测试环境
    process.env.NODE_ENV = 'test';
    
    // 连接测试数据库
    await databaseConnection.connect();
    await initializeDatabase();
  });

  afterAll(async () => {
    // 清理测试数据
    await cleanTestData();
    
    // 断开数据库连接
    await databaseConnection.disconnect();
  });

  beforeEach(async () => {
    // 每个测试前清理数据
    await cleanTestData();
  });

  describe('Database Connection', () => {
    test('should connect to database successfully', () => {
      expect(databaseConnection.isHealthy()).toBe(true);
    });

    test('should return connection info', () => {
      const info = databaseConnection.getConnectionInfo();
      expect(info).toHaveProperty('isConnected');
      expect(info).toHaveProperty('readyState');
      expect(info.isConnected).toBe(true);
    });
  });

  describe('User Model', () => {
    test('should create a user successfully', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: 'hashedpassword123'
      };

      const user = new models.User(userData);
      const savedUser = await user.save();

      expect(savedUser._id).toBeDefined();
      expect(savedUser.username).toBe(userData.username);
      expect(savedUser.email).toBe(userData.email);
      expect(savedUser.createdAt).toBeDefined();
    });

    test('should validate required fields', async () => {
      const user = new models.User({});
      
      await expect(user.save()).rejects.toThrow();
    });

    test('should hash password on save', async () => {
      const userData = {
        username: 'testuser2',
        email: 'test2@example.com',
        passwordHash: 'plainpassword'
      };

      const user = new models.User(userData);
      await user.save();

      expect(user.passwordHash).not.toBe('plainpassword');
      expect(user.passwordHash.length).toBeGreaterThan(20);
    });
  });

  describe('Document Model', () => {
    let testUser;

    beforeEach(async () => {
      testUser = new models.User({
        username: 'docuser',
        email: 'doc@example.com',
        passwordHash: 'password123'
      });
      await testUser.save();
    });

    test('should create a document successfully', async () => {
      const documentData = {
        userId: testUser._id,
        title: 'Test Document',
        originalFormat: 'pdf',
        filePath: '/uploads/test.pdf',
        markdownContent: '# Test Content'
      };

      const document = new models.Document(documentData);
      const savedDocument = await document.save();

      expect(savedDocument._id).toBeDefined();
      expect(savedDocument.title).toBe(documentData.title);
      expect(savedDocument.processingStatus).toBe('pending');
    });

    test('should update processing status', async () => {
      const document = new models.Document({
        userId: testUser._id,
        title: 'Test Document',
        originalFormat: 'pdf',
        filePath: '/uploads/test.pdf'
      });
      await document.save();

      await document.updateProcessingStatus('completed');
      expect(document.processingStatus).toBe('completed');
    });
  });

  describe('Summary Model', () => {
    let testUser, testDocument;

    beforeEach(async () => {
      testUser = new models.User({
        username: 'summaryuser',
        email: 'summary@example.com',
        passwordHash: 'password123'
      });
      await testUser.save();

      testDocument = new models.Document({
        userId: testUser._id,
        title: 'Test Document',
        originalFormat: 'pdf',
        filePath: '/uploads/test.pdf'
      });
      await testDocument.save();
    });

    test('should create a summary successfully', async () => {
      const summaryData = {
        documentId: testDocument._id,
        userId: testUser._id,
        type: 'detailed',
        content: 'This is a detailed summary of the document.'
      };

      const summary = new models.Summary(summaryData);
      const savedSummary = await summary.save();

      expect(savedSummary._id).toBeDefined();
      expect(savedSummary.type).toBe('detailed');
      expect(savedSummary.metadata.wordCount).toBeGreaterThan(0);
    });
  });

  describe('Concept Model', () => {
    let testUser, testDocument;

    beforeEach(async () => {
      testUser = new models.User({
        username: 'conceptuser',
        email: 'concept@example.com',
        passwordHash: 'password123'
      });
      await testUser.save();

      testDocument = new models.Document({
        userId: testUser._id,
        title: 'Test Document',
        originalFormat: 'pdf',
        filePath: '/uploads/test.pdf'
      });
      await testDocument.save();
    });

    test('should create a concept successfully', async () => {
      const conceptData = {
        term: 'Machine Learning',
        definition: 'A subset of artificial intelligence',
        documentId: testDocument._id,
        userId: testUser._id,
        occurrences: [{
          position: 100,
          context: 'Machine Learning is widely used...'
        }]
      };

      const concept = new models.Concept(conceptData);
      const savedConcept = await concept.save();

      expect(savedConcept._id).toBeDefined();
      expect(savedConcept.term).toBe('Machine Learning');
      expect(savedConcept.occurrences).toHaveLength(1);
    });
  });

  describe('MindMap Model', () => {
    let testUser, testDocument;

    beforeEach(async () => {
      testUser = new models.User({
        username: 'mindmapuser',
        email: 'mindmap@example.com',
        passwordHash: 'password123'
      });
      await testUser.save();

      testDocument = new models.Document({
        userId: testUser._id,
        title: 'Test Document',
        originalFormat: 'pdf',
        filePath: '/uploads/test.pdf'
      });
      await testDocument.save();
    });

    test('should create a mindmap successfully', async () => {
      const mindmapData = {
        documentId: testDocument._id,
        userId: testUser._id,
        title: 'Test MindMap',
        mermaidContent: 'graph TD\n  A[Start] --> B[End]',
        mermaidType: 'flowchart'
      };

      const mindmap = new models.MindMap(mindmapData);
      const savedMindmap = await mindmap.save();

      expect(savedMindmap._id).toBeDefined();
      expect(savedMindmap.mermaidType).toBe('flowchart');
      expect(savedMindmap.metadata.nodeCount).toBeGreaterThan(0);
    });
  });

  describe('Exercise Model', () => {
    let testUser, testDocument;

    beforeEach(async () => {
      testUser = new models.User({
        username: 'exerciseuser',
        email: 'exercise@example.com',
        passwordHash: 'password123'
      });
      await testUser.save();

      testDocument = new models.Document({
        userId: testUser._id,
        title: 'Test Document',
        originalFormat: 'pdf',
        filePath: '/uploads/test.pdf'
      });
      await testDocument.save();
    });

    test('should create an exercise successfully', async () => {
      const exerciseData = {
        documentId: testDocument._id,
        userId: testUser._id,
        title: 'Test Exercise',
        questions: [{
          id: 'q1',
          type: 'multiple_choice',
          question: 'What is 2+2?',
          options: ['3', '4', '5', '6'],
          correctAnswer: '4',
          explanation: 'Basic arithmetic',
          difficulty: 1,
          points: 10
        }]
      };

      const exercise = new models.Exercise(exerciseData);
      const savedExercise = await exercise.save();

      expect(savedExercise._id).toBeDefined();
      expect(savedExercise.questions).toHaveLength(1);
      expect(savedExercise.metadata.totalQuestions).toBe(1);
      expect(savedExercise.metadata.totalPoints).toBe(10);
    });
  });

  describe('ExerciseRecord Model', () => {
    let testUser, testDocument, testExercise;

    beforeEach(async () => {
      testUser = new models.User({
        username: 'recorduser',
        email: 'record@example.com',
        passwordHash: 'password123'
      });
      await testUser.save();

      testDocument = new models.Document({
        userId: testUser._id,
        title: 'Test Document',
        originalFormat: 'pdf',
        filePath: '/uploads/test.pdf'
      });
      await testDocument.save();

      testExercise = new models.Exercise({
        documentId: testDocument._id,
        userId: testUser._id,
        title: 'Test Exercise',
        questions: [{
          id: 'q1',
          type: 'multiple_choice',
          question: 'What is 2+2?',
          options: ['3', '4', '5', '6'],
          correctAnswer: '4',
          difficulty: 1,
          points: 10
        }]
      });
      await testExercise.save();
    });

    test('should create an exercise record successfully', async () => {
      const recordData = {
        exerciseId: testExercise._id,
        userId: testUser._id,
        documentId: testDocument._id,
        answers: [{
          questionId: 'q1',
          userAnswer: '4',
          correctAnswer: '4',
          isCorrect: true,
          timeSpent: 30,
          points: 10,
          maxPoints: 10,
          difficulty: 1,
          questionType: 'multiple_choice'
        }]
      };

      const record = new models.ExerciseRecord(recordData);
      const savedRecord = await record.save();

      expect(savedRecord._id).toBeDefined();
      expect(savedRecord.performance.correctAnswers).toBe(1);
      expect(savedRecord.performance.accuracy).toBe(100);
      expect(savedRecord.score.percentage).toBe(100);
      expect(savedRecord.score.grade).toBe('A+');
    });
  });
});