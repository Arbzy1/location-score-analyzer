from pyngrok import ngrok
import os
import subprocess
import time
import sys
import webbrowser

# Flask app file to run
FLASK_APP = "app.py"  # Modify this if your Flask app is located elsewhere

def run_flask_with_ngrok():
    print("🚀 Starting Flask app with ngrok tunnel...")
    
    # Start ngrok
    try:
        port = 5000
        public_url = ngrok.connect(port, bind_tls=True).public_url
        print(f"✅ ngrok tunnel established at: {public_url}")
        print(f"🌐 Use this URL for your frontend API_URL: {public_url}")
        
        # Save the URL to a file so the frontend can use it
        with open("ngrok_url.txt", "w") as f:
            f.write(public_url)
        
        print("\n📋 Copy this URL and update your frontend config or .env file:")
        print(f"API_URL={public_url}\n")
        
        # Use the correct Python executable (the one that's running this script)
        python_exe = sys.executable
        
        # Run Flask app in a separate process
        flask_command = [python_exe, FLASK_APP]
        print(f"🔄 Starting Flask with command: {' '.join(flask_command)}")
        
        flask_process = subprocess.Popen(flask_command)
        
        print("⚙️ Flask app is now running with ngrok tunnel...")
        print("📊 ngrok inspection interface: http://127.0.0.1:4040")
        print("🛑 Press Ctrl+C to stop")
        
        # Open the ngrok inspection interface in the browser
        webbrowser.open("http://127.0.0.1:4040")
        
        # Keep the script running until interrupted
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\n⛔ Stopping ngrok tunnel and Flask app...")
            ngrok.kill()
            flask_process.terminate()
    
    except Exception as e:
        print(f"❌ Error setting up ngrok: {str(e)}")
        ngrok.kill()
        return

if __name__ == "__main__":
    run_flask_with_ngrok() 