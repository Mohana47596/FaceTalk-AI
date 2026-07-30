import json

filepath = r"C:\Users\ADMIN\.gemini\antigravity\brain\fabe8f7e-cb00-4270-9a32-baa1088e3f88\.system_generated\logs\transcript_full.jsonl"

edits = []
with open(filepath, 'r', encoding='utf-8') as f:
    for line in f:
        obj = json.loads(line)
        if obj.get('type') == 'PLANNER_RESPONSE':
            tool_calls = obj.get('tool_calls', [])
            for tc in tool_calls:
                name = tc.get('name')
                if name in ('replace_file_content', 'multi_replace_file_content'):
                    args = tc.get('args', {})
                    if 'Avatar3D.jsx' in args.get('TargetFile', ''):
                        edits.append(tc)

print(f"Total edits: {len(edits)}")
for idx, tc in enumerate(edits):
    args = tc.get('args', {})
    replacement = args.get('ReplacementContent', '')
    if 'setTransform' in replacement:
        print(f"\n=================== EDIT {idx} ===================")
        print(f"Instruction: {args.get('Instruction')}")
        print(f"StartLine: {args.get('StartLine')}, EndLine: {args.get('EndLine')}")
        print("ReplacementContent:")
        print(replacement)
