# Use the full Node 21 Debian-based image
FROM public.ecr.aws/docker/library/node:21

WORKDIR /app

# Install MySQL client for mysqldump and AWS CLI
RUN apt-get update && \
    apt-get install -y default-mysql-client curl unzip && \
    curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" && \
    unzip awscliv2.zip && \
    ./aws/install && \
    rm -rf awscliv2.zip ./aws && \
    rm -rf /var/lib/apt/lists/*

# Verify the AWS CLI installation
RUN aws --version

# Copy only package files initially to leverage Docker cache for dependencies
COPY package*.json ./
RUN npm install

# Copy the entire application after installing dependencies
COPY . .

# Build the application
RUN npm run build

# Expose the application port
EXPOSE 3000

# Start the server as the default command
CMD ["node", "dist/main"]
