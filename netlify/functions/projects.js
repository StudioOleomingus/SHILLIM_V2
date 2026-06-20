const fs = require('fs');
const path = require('path');

// Helper to read projects
const getProjects = () => {
  const filePath = path.join(__dirname, '../../data/projects.json');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return data.projects;
};

// Helper to write projects
const saveProjects = (projects) => {
  const filePath = path.join(__dirname, '../../data/projects.json');
  fs.writeFileSync(filePath, JSON.stringify({ projects }, null, 2));
};

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle OPTIONS request for CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    if (event.httpMethod === 'GET') {
      const projects = getProjects();
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ projects })
      };
    }

    if (event.httpMethod === 'POST') {
      const projects = getProjects();
      const data = JSON.parse(event.body);
      const index = parseInt(data.index);

      if (index === -1) {
        // Add new project
        projects.push(data.project);
      } else {
        // Update existing project
        projects[index] = data.project;
      }

      saveProjects(projects);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(projects)
      };
    }

    if (event.httpMethod === 'DELETE') {
      const projects = getProjects();
      const index = parseInt(event.path.split('/').pop());
      projects.splice(index, 1);
      saveProjects(projects);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(projects)
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
