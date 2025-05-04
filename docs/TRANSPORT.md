# Transport Setup Guide

This guide explains how to set up and use the transport features of the Location Score Analyzer, focusing on the integration with OpenTripPlanner (OTP) for bus transit routing.

## Overview

The Location Score Analyzer supports multiple transport modes:

- **Driving**: Uses OpenRouteService (ORS)
- **Cycling**: Uses OpenRouteService (ORS)
- **Walking**: Uses OpenRouteService (ORS)
- **Bus Transit**: Uses OpenTripPlanner (OTP)

The system can automatically select the fastest mode for each journey or use a specific mode based on user preference.

## Setting Up OpenTripPlanner

### Prerequisites

- Java Runtime Environment (JRE) 11 or higher
- At least 4GB of RAM available
- GTFS data for your region (in .zip format)
- OpenStreetMap data for your region (.pbf format)

### Installation Steps

1. **Download OpenTripPlanner**:
   ```bash
   wget https://repo1.maven.org/maven2/org/opentripplanner/otp/2.2.0/otp-2.2.0-shaded.jar -O otp.jar
   ```

2. **Prepare Data Directory**:
   ```bash
   mkdir -p otp/graphs/default
   ```

3. **Add Data Files**:
   - Place your GTFS data zip file(s) in the `otp/graphs/default` directory
   - Place your OpenStreetMap .pbf file in the `otp/graphs/default` directory

4. **Build the Graph**:
   ```bash
   java -Xmx4G -jar otp.jar --build --save otp/graphs/default
   ```
   This process may take 30-60 minutes depending on the size of your data.

5. **Start the OTP Server**:
   ```bash
   java -Xmx2G -jar otp.jar --router default --server
   ```

6. **Verify Installation**:
   - Open a browser and navigate to `http://localhost:8080`
   - You should see the OpenTripPlanner web interface

## Setting Up OpenRouteService (ORS)

### Prerequisites

- Docker and Docker Compose
- At least 2GB of RAM available
- OpenStreetMap data for your region (.pbf format)

### Installation Steps

1. **Clone the ORS Repository**:
   ```bash
   git clone https://github.com/GIScience/openrouteservice.git
   cd openrouteservice
   ```

2. **Configure ORS**:
   - Copy your OpenStreetMap PBF file to the `docker/data` directory
   - Adjust the `docker-compose.yml` file to point to your PBF file

3. **Start ORS**:
   ```bash
   docker-compose up -d
   ```

4. **Verify Installation**:
   - Open a browser and navigate to `http://localhost:8080/ors`
   - You should see the ORS web interface

## Configuring the Location Score Analyzer

### Server Configuration

1. Open `source-code/server/app.py`
2. Ensure the OTP_API_URL variable is set correctly:
   ```python
   OTP_API_URL = "http://localhost:8080/otp/routers/default/index/graphql"
   ```
3. Also check the ORS configuration in the `ors_minutes` function:
   ```python
   url = f"http://192.168.1.162:8080/ors/v2/directions/{profile}?start={start_point}&end={end_point}"
   ```
   Update the IP address and port to match your ORS server.

### Testing the Configuration

1. Start your server:
   ```bash
   cd source-code/server
   python app.py
   ```

2. Test the OTP connection:
   - Navigate to `http://localhost:5000/otp-status` in your browser
   - You should see a JSON response with `"status": "available"` if OTP is properly connected

3. Test a specific route:
   - Navigate to `http://localhost:5000/test-otp` in your browser
   - This will calculate a sample route using the bus transit mode

## Using Transport Modes

### In the User Interface

1. **Global Mode Selection**:
   - In the travel preferences section, select your preferred transport mode from the dropdown
   - Options include: Auto, Driving, Cycling, Walking, Bus
   - The selected mode will be used for all destinations unless overridden

2. **Per-Destination Mode Selection**:
   - For each destination in your frequent locations, you can select a specific transport mode
   - These settings will be overridden if a global mode is selected

3. **Transport Comparison**:
   - In the location results, expand the "Transport Mode Comparison" section
   - This shows travel times for each mode to each destination
   - The selected mode (used for scoring) is marked with a checkmark

### Fallback Mechanism

When Bus Transit mode is selected but no bus route is available for a particular journey, the system will:

1. Try to find a Walking route as the first alternative
2. If no Walking route, try Cycling
3. If no Cycling route, try Driving
4. If no route is found by any mode, the journey will be excluded from score calculation

This ensures the system can provide useful scores even when public transport options are limited.

## Troubleshooting

### OTP Not Responding

If the OpenTripPlanner service is not responding:

1. Check that the OTP server is running:
   ```bash
   ps aux | grep otp
   ```

2. Ensure the Java process is active and has sufficient memory:
   ```bash
   ps aux | grep java
   ```

3. Restart the OTP server if necessary:
   ```bash
   java -Xmx2G -jar otp.jar --router default --server
   ```

### ORS Not Responding

If the OpenRouteService is not responding:

1. Check that the Docker containers are running:
   ```bash
   docker ps | grep openrouteservice
   ```

2. Check the logs for any errors:
   ```bash
   docker logs openrouteservice_ors_1
   ```

3. Restart the ORS container if necessary:
   ```bash
   docker-compose restart
   ```

### No Bus Routes Found

If bus routes are consistently not found:

1. Check that your GTFS data is valid and contains routes for the area you're testing
2. Verify that the date/time used for routing is within the GTFS schedule period
3. Try adjusting the `dt_iso` parameter in the `otp_fastest_minutes` function to match your GTFS data period

### Performance Issues

If you experience slow response times:

1. Increase the memory allocated to OTP:
   ```bash
   java -Xmx4G -jar otp.jar --router default --server
   ```

2. Consider adding an LRU cache to frequently used routes by increasing the `maxsize` parameter in the `@lru_cache` decorator for the `otp_fastest_minutes` function.

## Advanced Configuration

For advanced OTP configuration options, please refer to the [OpenTripPlanner documentation](http://docs.opentripplanner.org/en/latest/).

For advanced ORS configuration options, please refer to the [OpenRouteService documentation](https://openrouteservice.org/dev/#/api-docs).

You can customize the OTP behavior by creating a `build-config.json` and `router-config.json` in your graph directory. These files allow fine-tuning of routing parameters, transit preferences, and more. 