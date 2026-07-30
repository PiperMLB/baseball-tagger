import csv
import json

csv_file_path = r'c:\Users\Piper.Dubow\Downloads\all_posts_tagger.csv'
json_file_path = 'posts.json'

posts = []

print("Reading CSV file...")
with open(csv_file_path, mode='r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    for row in reader:
        posts.append(row)

print("Writing to posts.json...")
with open(json_file_path, mode='w', encoding='utf-8') as f:
    json.dump(posts, f, indent=2)

print(f"✅ Success! Converted {len(posts)} rows into posts.json")