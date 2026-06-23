const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');



// your controller
const userRoutes = require('./routes/userRoutes'); 
const authRoutes = require('./routes/authRoutes'); 
const statsRoutes = require('./routes/statsRoutes');
const typeRoutes = require('./routes/typeRoutes');
const errorRoutes = require('./routes/errorRoutes');
const exerciseRoutes = require('./routes/exerciseRoutes');
const componentRoutes = require('./routes/componentRoutes');
const feedbackRoutes = require('./routes/feedbackRoutes');
const moderationRoutes = require('./routes/moderationRoutes');
const projectRoutes = require('./routes/projectRoutes');

const moderationMessagesRoutes = require('./routes/moderationMessagesRoutes');


const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;

const cors = require('cors');
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));


// Swagger definition
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Feedback Management Platform API',
    version: '1.0.0',
    description: 'API documentation for managing users, task types, errors, exercises, components, and feedbacks',
  },
  servers: [
  {
    url: process.env.API_BASE_URL || `http://localhost:${PORT}`,
    description: 'Dynamic server',
  },
],


  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  security: [{ bearerAuth: [] }],
};


// Options for swagger-jsdoc
const options = {
    swaggerDefinition,
    apis: ['./routes/*.js'], // <-- points to your controller for docs
};

// Initialize swagger-jsdoc
const swaggerSpec = swaggerJsdoc(options);

// Setup Swagger UI route
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

const path = require("path");
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Your API routes
app.use('/api', authRoutes);
app.use('/api/statistics', statsRoutes);
app.use('/api/users', userRoutes);
app.use('/api/types', typeRoutes); 
app.use('/api/errors', errorRoutes); 
app.use('/api/exercises', exerciseRoutes); 
app.use('/api/components', componentRoutes); 
app.use('/api/feedbacks', feedbackRoutes); 
app.use('/api/moderations', moderationRoutes); 
app.use('/api/projects', projectRoutes); 
app.use('/api/moderationMessages', moderationMessagesRoutes);



app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
    console.log(`Swagger UI available at http://localhost:${PORT}/api-docs`);
});
