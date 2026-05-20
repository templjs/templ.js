import sys
import re

def parse_logs(file_path):
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Lint Work Item Frontmatter (77020918403)
    # Require Release Metadata (77020918388)
    # Lint (77020918389)
    
    # Try to find error sections for each job
    print("--- FAILURE ANALYSIS ---")
    
    # Common error patterns
    if "Lint Work Item Frontmatter" in content:
        print("\n[Lint Work Item Frontmatter]")
        match = re.search(r"ERROR.*lint-frontmatter.*", content, re.IGNORECASE)
        if match:
            print(match.group(0))
        else:
            # Look for specific check failure
            print("Check failed: Frontmatter validation. Likely missing 'work-item' metadata in PR body or commit.")

    if "Require Release Metadata" in content:
        print("\n[Require Release Metadata]")
        if "Missing release metadata" in content or "FAILURE" in content:
            print("Check failed: PR is missing required release metadata (likely in the body).")

    if "Lint" in content:
        print("\n[Lint]")
        # Look for eslint/prettier errors
        eslint_matches = re.findall(r"(\/.*:\d+:\d+.*error.*)", content)
        for m in eslint_matches[:5]:
            print(m)

parse_logs(sys.argv[1])
