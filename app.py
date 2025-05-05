from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import requests
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
# Configure CORS to allow everything
CORS(app, resources={r"/*": {"origins": "*", "allow_headers": "*", "expose_headers": "*", "methods": "*", "supports_credentials": True}})

@app.route('/api/postcode/<postcode>')
def get_postcode_info(postcode):
    try:
        # Clean the postcode - remove spaces and convert to uppercase
        cleaned_postcode = postcode.strip().replace(' ', '').upper()
        print(f"Processing postcode: {cleaned_postcode}")
        
        response = requests.get(f'https://api.postcodes.io/postcodes/{cleaned_postcode}')
        print(f"Postcodes.io response status: {response.status_code}")
        
        if response.status_code == 200:
            return jsonify(response.json())
        else:
            error_msg = f'Postcode API error: {response.status_code}'
            print(error_msg)
            return jsonify({'error': error_msg}), response.status_code
    except Exception as e:
        error_msg = f'Error processing postcode: {str(e)}'
        print(error_msg)
        return jsonify({'error': error_msg}), 500

@app.route('/api/postcode/<postcode>/amenities')
def get_postcode_amenities(postcode):
    try:
        # First get the coordinates from postcode
        postcode_response = requests.get(f'https://api.postcodes.io/postcodes/{postcode}')
        if postcode_response.status_code != 200:
            return jsonify({'error': 'Invalid postcode'}), 400
            
        data = postcode_response.json()
        lat = data['result']['latitude']
        lon = data['result']['longitude']
        
        # Then get amenities using the coordinates
        # This is a placeholder - replace with your actual amenities API call
        amenities = {
            'schools': [],
            'hospitals': [],
            'supermarkets': []
        }
        
        return jsonify(amenities)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Add a health check endpoint for Render
@app.route('/health')
def health_check():
    return jsonify({"status": "healthy"}), 200

# Add a new route to add unrestricted CORS headers
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', '*')
    response.headers.add('Access-Control-Allow-Methods', '*')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    # Remove any security headers that might restrict access
    response.headers.pop('X-Frame-Options', None)
    response.headers.pop('Content-Security-Policy', None)
    return response

if __name__ == '__main__':
    # Get port from environment variable for Render compatibility
    port = int(os.environ.get('PORT', 5000))
    # Use 0.0.0.0 to bind to all interfaces
    app.run(debug=True, host='0.0.0.0', port=port, ssl_context='adhoc') # Add SSL context 