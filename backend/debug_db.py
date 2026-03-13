from db_operations import insert_budget_values_batch, get_budget_values_for_project
import json
import traceback

def debug_test():
    try:
        project_id = 1
        test_values = [
            {
                "budget_item_id": 5,
                "quantity": 2.0,
                "rate": 100.0,
                "additional1": 50.0,
                "additional2": 25.0,
                "comment1": "Test1",
                "comment2": "Test2",
                "total": 275.0
            }
        ]
        
        print("Executing insert_budget_values_batch...")
        affected = insert_budget_values_batch(project_id, test_values)
        print(f"Affected: {affected}")
        
        print("Executing get_budget_values_for_project...")
        res = get_budget_values_for_project(project_id)
        print("Raw result keys:", res.keys())
        if '1' in res:
            print("Item 1 data:", json.dumps(res['1'], indent=2))
        else:
            print("Item 1 not found in result.")
            
    except Exception as e:
        print("ERROR OCCURRED:")
        traceback.print_exc()

if __name__ == "__main__":
    debug_test()
