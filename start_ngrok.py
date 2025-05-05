from pyngrok import ngrok
import time
import webbrowser

def start_ngrok():
    print("🚀 Starting ngrok tunnel to localhost:5000...")
    
    try:
        # Start ngrok tunnel to port 5000
        public_url = ngrok.connect(5000, bind_tls=True).public_url
        print(f"✅ ngrok tunnel established!")
        print(f"🌐 Public URL: {public_url}")
        
        # Save the URL to a file for reference
        with open("ngrok_url.txt", "w") as f:
            f.write(public_url)
        
        print("\n📋 Update your frontend API_URL to:")
        print(f"{public_url}")
        
        # Instructions for the user
        print("\n📋 Copy this for your frontend code:")
        print(f"// API configuration")
        print(f"export const API_URL = '{public_url}';")
        print("\n⚠️ Remember to start your Flask app separately with:")
        print("python app.py")
        
        # Open the ngrok inspection interface
        print("\n📊 Opening ngrok inspection interface...")
        webbrowser.open("http://127.0.0.1:4040")
        
        print("\n🛑 Press Ctrl+C to stop ngrok tunnel")
        
        # Keep running until user interrupts
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\n⛔ Stopping ngrok tunnel...")
    
    except Exception as e:
        print(f"❌ Error: {str(e)}")
    
    finally:
        ngrok.kill()
        print("✅ ngrok tunnel closed")

if __name__ == "__main__":
    start_ngrok() 