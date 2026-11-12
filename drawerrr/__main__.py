"""Run the Drawerrr checkpoint or full receipt-based evaluation."""

import argparse
import json

from drawerrr.draft import draft_message
from drawerrr.evaluate import run_checkpoint, run_evaluation


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--checkpoint", action="store_true", help="Run the paired mutation proof as JSON")
    mode.add_argument("--demo", action="store_true", help="Show the draft and paired proof in the terminal")
    args = parser.parse_args()

    if args.demo:
        print("Clinical RAG draft · htn-002 · synthetic patient A")
        print(draft_message())
    result = run_checkpoint() if args.checkpoint or args.demo else run_evaluation()

    if args.demo:
        for name, variant in result["variants"].items():
            print(f"\n{name.replace('_', ' ').title()}")
            for row in variant["cases"]:
                print(
                    f"  {row['case']} | approved {row['approved_recipient']} | "
                    f"attempted {row['attempted_recipient']} | {row['executor_outcomes']}"
                )
                print(f"    portal receipts = {json.dumps(row['portal_receipts'])}")
        print(f"\nPaired proof {'passed' if result['passed'] else 'failed'}")
    else:
        print(json.dumps(result, indent=2, sort_keys=True))

    return 0 if result["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
