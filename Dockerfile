# Use the official lightweight Nginx image based on Alpine Linux
FROM nginx:alpine

# Copy our custom, highly optimized Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the static web application files to Nginx public HTML directory
COPY index.html /usr/share/nginx/html/
COPY script.js /usr/share/nginx/html/
COPY data.json /usr/share/nginx/html/
COPY styles.css /usr/share/nginx/html/

# Expose port 80 to the outside world
EXPOSE 80

# Start Nginx in the foreground
CMD ["nginx", "-g", "daemon off;"]
