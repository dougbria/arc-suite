
import sys
import os

path = '/Users/doug/Developer/arc-workspaces/apps/render/src/app.js'
if not os.path.exists(path):
    print(f'File not found: {path}')
    sys.exit(1)

content = open(path).read()
stack = []
i = 0
in_string = None
in_comment = None
while i < len(content):
    char = content[i]
    if in_comment == 'single':
        if char == '\n': in_comment = None
    elif in_comment == 'multi':
        if content[i:i+2] == '*/': in_comment = None; i += 1
    elif in_string:
        if char == '\\': i += 1
        elif char == in_string: in_string = None
    else:
        if content[i:i+2] == '//': in_comment = 'single'; i += 1
        elif content[i:i+2] == '/*': in_comment = 'multi'; i += 1
        elif char in ('"', "'", '`'): in_string = char
        elif char == '{':
            line = content.count('\n', 0, i) + 1
            stack.append((line, i))
        elif char == '}':
            line = content.count('\n', 0, i) + 1
            if not stack:
                print(f'Extra closing brace at line {line}')
            else:
                stack.pop()
    i += 1

if stack:
    for line, _ in stack:
        print(f'Unclosed brace at line {line}')
else:
    print('All braces are balanced.')
