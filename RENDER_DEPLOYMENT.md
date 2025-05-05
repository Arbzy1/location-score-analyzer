# Render Deployment Guide

This guide explains how to deploy this application to Render's cloud hosting platform.

## Prerequisites

- A [Render account](https://render.com/)
- Your code pushed to a Git repository (GitHub, GitLab, etc.)

## Deployment Steps

### 1. Configure Environment Variables

Before deploying, make sure to set up the following environment variables in your client code:

```bash
# Client-side environment variable (.env file in client directory)
VITE_API_URL=https://your-backend-service-name.onrender.com
```

Replace `your-backend-service-name` with the actual subdomain of your backend service on Render.

### 2. Deploy the Backend Service

1. In the Render dashboard, click **New** and select **Web Service**
2. Connect your Git repository
3. Configure the service with these settings:
   - **Name**: `your-app-backend` (choose a name)
   - **Root Directory**: `source-code/server` (if your backend is in this folder)
   - **Runtime**: `Python 3` (or `Node` if using Node.js)
   - **Build Command**: 
     - For Python: `pip install -r requirements.txt`
     - For Node.js: `npm install`
   - **Start Command**: 
     - For Python: `python app.py`
     - For Node.js: `node index.js`
4. Add any required environment variables
5. Click **Create Web Service**

### 3. Deploy the Frontend as a Static Site

1. In the Render dashboard, click **New** and select **Static Site**
2. Connect your Git repository
3. Configure the service with these settings:
   - **Name**: `your-app-frontend` (choose a name)
   - **Root Directory**: `source-code/client` (if your frontend is in this folder)
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist` (default for Vite)
4. Add any required environment variables, including:
   - `VITE_API_URL=https://your-backend-service-name.onrender.com`
5. Click **Create Static Site**

### 4. Configure CORS (if needed)

Ensure your backend allows CORS from your frontend domain. This is already set up in the application code but verify if it's working correctly after deployment.

### Port Configuration

Both the Python Flask app and the Node.js Express server are configured to listen on the port specified by Render's `PORT` environment variable, which is set automatically by Render.

```python
# Python (app.py)
port = int(os.environ.get('PORT', 5000))
app.run(debug=False, host='0.0.0.0', port=port)
```

```javascript
// Node.js (index.js)
const port = process.env.PORT || 5000;
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});
```

## Troubleshooting

1. **Connection Issues**: If the frontend can't connect to the backend, check:
   - CORS configuration
   - Environment variables
   - Network logs in the browser console

2. **Build Failures**: Check the build logs in Render dashboard

3. **Runtime Errors**: Check the logs in Render dashboard

## Additional Resources

- [Render Documentation](https://render.com/docs)
- [Deploying a Flask Application](https://render.com/docs/deploy-flask)
- [Deploying a Node.js Application](https://render.com/docs/deploy-node-express-app)
- [Deploying a Static Site](https://render.com/docs/deploy-static-site) 