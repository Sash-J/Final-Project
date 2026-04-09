import cloudinary
import cloudinary.uploader
from cloudinary.utils import cloudinary_url
import os
from dotenv import load_dotenv

load_dotenv()

# Configure Cloudinary
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True
)

def upload_project_image(base64_image, project_name):
    """
    Uploads a base64 image string to Cloudinary.
    Returns the secure URL of the uploaded image.
    """
    if not base64_image:
        return None
        
    try:
        # Sanitize project name for public_id
        folder = "vision_division/projects"
        public_id = f"{project_name.lower().replace(' ', '_')}_{os.urandom(4).hex()}"
        
        upload_result = cloudinary.uploader.upload(
            base64_image,
            folder=folder,
            public_id=public_id,
            overwrite=True,
            resource_type="image"
        )
        
        return upload_result.get("secure_url")
    except Exception as e:
        print(f"Cloudinary Upload Error: {str(e)}")
        # Fallback: if it's already a URL, just return it
        if base64_image.startswith("http"):
            return base64_image
        return None

def delete_project_image(image_url):
    """
    Deletes an image from Cloudinary given its URL.
    """
    if not image_url or "cloudinary" not in image_url:
        return
        
    try:
        # Extract public_id from URL
        # URL format: https://res.cloudinary.com/cloud_name/image/upload/v12345/folder/public_id.jpg
        parts = image_url.split('/')
        last_parts = parts[-1].split('.')
        public_id = parts[-2] + "/" + last_parts[0] # Includes folder
        
        cloudinary.uploader.destroy(public_id)
    except Exception as e:
        print(f"Cloudinary Delete Error: {str(e)}")
