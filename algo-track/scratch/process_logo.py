import os
from PIL import Image

def make_transparent_icon():
    print(f"Current directory: {os.getcwd()}")
    public_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "public"))
    print(f"Computed public directory: {public_dir}")
    
    img_path = os.path.join(public_dir, "BLACKLOGO.png")
    if not os.path.exists(img_path):
        print(f"BLACKLOGO.png not found at: {img_path}")
        return

    # Open image
    img = Image.open(img_path)
    print(f"Image size: {img.size}")
    
    # Detected background color in BLACKLOGO is pure black
    bg_color = (0, 0, 0)
    print(f"Using background color for transparency filter: {bg_color}")
    
    # Convert image to RGBA
    rgba_img = img.convert("RGBA")
    datas = rgba_img.getdata()
    
    new_data = []
    # Make pixels close to black transparent
    for item in datas:
        # dist to bg_color
        dist = ((item[0] - bg_color[0])**2 + (item[1] - bg_color[1])**2 + (item[2] - bg_color[2])**2)**0.5
        # Threshold: if it is very close to black, make it transparent.
        # But we must preserve the nice outer glow of the cyan/purple lines.
        # Let's use a conservative threshold of 15 to keep details, or 25.
        if dist < 25: 
            new_data.append((0, 0, 0, 0))
        else:
            # We want to make sure it blends perfectly.
            # We can also smoothly transition pixels close to black to semi-transparent!
            if dist < 60:
                # Smooth alpha transition
                alpha = int(((dist - 25) / (60 - 25)) * 255)
                new_data.append((item[0], item[1], item[2], max(0, min(255, alpha))))
            else:
                new_data.append(item)
            
    rgba_img.putdata(new_data)
    
    width, height = rgba_img.size
    
    # Crop the top 65% for the icon (the stylized "A" logo)
    crop_height = int(height * 0.65)
    icon_img = rgba_img.crop((0, 0, width, crop_height))
    
    # Auto-crop transparent borders
    bbox = icon_img.getbbox()
    if bbox:
        icon_img = icon_img.crop(bbox)
        
    icon_dark_path = os.path.join(public_dir, "logo-icon-dark.png")
    icon_img.save(icon_dark_path, "PNG")
    print(f"Saved transparent dark icon to {icon_dark_path} with size {icon_img.size}")
    
    icon_light_path = os.path.join(public_dir, "logo-icon-light.png")
    icon_img.save(icon_light_path, "PNG")
    print(f"Saved transparent light icon to {icon_light_path}")

if __name__ == "__main__":
    make_transparent_icon()
