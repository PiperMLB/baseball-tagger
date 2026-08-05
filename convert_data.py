import csv
import json

csv_file_path = 'ai_bigquery_export.csv'  # Your downloaded BigQuery CSV
json_file_path = 'ai_posts.json'

posts = []

with open(csv_file_path, mode='r', encoding='utf-8') as csv_file:
    reader = csv.DictReader(csv_file)
    
    for row in reader:
        # Convert binary 1/0 flags into strings/booleans
        # 1 = Reach new audience, 0 = Target current audience
        raw_objective = str(row.get('objective', '')).strip()
        objective_value = "Reach new audience" if raw_objective == "1" else "Target current audience"
        
        # 1 = True (Is Score Graphic), 0 = False
        raw_score = str(row.get('score_graphic', '')).strip()
        is_score_graphic = True if raw_score == "1" else False

        post = {
            "post_id": row.get('post_id'),
            "channel": row.get('channel'),
            "post_type": row.get('post_type'),
            "post_url": row.get('post_url'),
            "post_content": row.get('post_content'),
            "post_date_pt": row.get('post_date_pt'),
            
            # AI Predictions
            "ai_club": row.get('focal_club'),
            "ai_player": row.get('focal_player'),
            "ai_objective": objective_value,
            "ai_score_graphic": is_score_graphic,
            "ai_text_description": row.get('text_description')
        }
        posts.append(post)

with open(json_file_path, mode='w', encoding='utf-8') as json_file:
    json.dump(posts, json_file, indent=2)

print(f"Successfully converted {len(posts)} AI posts to {json_file_path}")