# File Structure Rules

This document defines the mapping rules for file paths based on subject and page parameters. The AI should use these rules to determine the correct file structure path.

## Structure Overview

The files are organized in a hierarchical structure:
- `/files/` - Root directory for all files
- Subject-based directories (e.g., `admitere`, `mate`, `fizica`, etc.)
- Page-based subdirectories with specific patterns

## Mapping Rules

### Rule Priority (Apply in this order):

#### 1. Special Case: Admitere Subject
For `subject:admitere`, the structure is different from regular subjects:

**Pattern:** `/files/admitere/{subsubject}/{page_type}/*`

Examples:
- `subject:admitere page:fizica` → `/files/admitere/fizica/admitere/*`
- `subject:admitere page:mate` → `/files/admitere/mate/admitere/*` 
- `subject:admitere page:info` → `/files/admitere/info/admitere/*`
- `subject:admitere page:fizica/extra` → `/files/admitere/fizica/extra/*`
- `subject:admitere page:mate/extra` → `/files/admitere/mate/extra/*`
- `subject:admitere page:info/extra` → `/files/admitere/info/extra/*`

**Logic:** 
- If page contains `/extra`, use the extra folder
- Otherwise, use the `admitere` folder for that subsubject

#### 2. Regular Subjects with Extra Pages
For any subject with `page:extra`:

**Pattern:** `/files/{subject}/extra/*`

Examples:
- `subject:mate page:extra` → `/files/mate/extra/*`
- `subject:fizica page:extra` → `/files/fizica/extra/*`
- `subject:chimie page:extra` → `/files/chimie/extra/*`

#### 3. Regular Subjects with Regular Pages
For any subject with regular pages (not extra, not admitere):

**Pattern:** `/files/{subject}/pages/{page}/*`

Examples:
- `subject:mate page:bac` → `/files/mate/pages/bac/*`
- `subject:fizica page:bac` → `/files/fizica/pages/bac/*`
- `subject:mate page:teste-de-antrenament` → `/files/mate/pages/teste-de-antrenament/*`
- `subject:fizica page:simulari-judetene` → `/files/fizica/pages/simulari-judetene/*`
- `subject:chimie page:olimpiada` → `/files/chimie/pages/olimpiada/*`

## Summary of Structure Patterns:

1. **Admitere subjects:** `/files/admitere/{subsubject}/{admitere|extra}/*`
2. **Extra pages:** `/files/{subject}/extra/*`  
3. **Regular pages:** `/files/{subject}/pages/{page}/*`

## Notes for AI Implementation:

- `{subject}` can be any Romanian baccalaureate subject (mate, fizica, chimie, biologie, etc.)
- `{page}` can be any page identifier (bac, teste-de-antrenament, simulari-judetene, etc.)
- `{subsubject}` for admitere can be mate, fizica, info, etc.
- Always check for "admitere" subject first, as it has a special structure
- Then check for "extra" in the page parameter
- Finally, apply the regular pages pattern
- Use exact string matching, case-sensitive