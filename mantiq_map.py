from node import *

class MantiqMap:
    
    # Constructor
    def __init__(self, root=None):
        self.title = ""
        self.root = None
        if root:
            self.set_root(root)

    # Public methods
    def set_root(self, root):
        self.root = root
        root.is_root = True
        self.assign_numbers()

    def set_title(self, title):
        self.title = title

    def add_subpremise(self,
                    number: int = 0, 
                    barebones_form = "", 
                    written_premise = "", 
                    premise_type: PremiseType | None = None
                    ):
        if number == 0:
            self.root.add_premise(barebones_form, written_premise, premise_type)
        else:
            target_premise = self.find_node_by_number(self.root, f"P{number}")
        
            if target_premise:
                target_premise.add_premise(barebones_form, written_premise, premise_type)
            else:
                raise ValueError(f"P{number} not found.")
        
        self.assign_numbers()
  
    def delete_premise(self, premise_number_str: str):
        def recurse_delete(node, target_num):
            for i, premise in enumerate(node.premises):
                if premise.number == target_num:
                    del node.premises[i]
                    return True
                if recurse_delete(premise, target_num):
                    return True
            return False
        
        if recurse_delete(self.root, premise_number_str):
            self.assign_numbers()
    
    def display(self):
        self.root.recursive_display()
    
    def get_chart_representation(self) -> list:
        charts = []

        # =============== 1. HIGH-LEVEL ARGUMENT TABLE ===============
        high_level_rows = []
        for p in self.root.premises:
            high_level_rows.append({
                "number": p.number,
                "barebones": p.barebones_form,
                "written_premise": p.written_premise,
                "premise_type": self.format_premise_type(p.premise_type)
            })
            
        high_level_rows.append({
            "number": "C",
            "barebones": self.root.barebones_form,
            "written_premise": self.root.written_premise
        })

        charts.append({
            "title": "High-Level Argument" + (f" For {self.title.title()}" if self.title else ""),
            "rows": high_level_rows,
            "level": 1
        })

        # =============== 2. SUB-ARGUMENT TABLES ===============
        def add_subtables(node, depth):
            for premise in node.premises:
                if premise.premises: 
                    subt_rows = []
                    for child in premise.premises:
                        subt_rows.append({
                            "number": child.number,
                            "barebones": child.barebones_form,
                            "written_premise": child.written_premise,
                            "premise_type": self.format_premise_type(child.premise_type)
                        })

                    subt_rows.append({
                        "number": premise.number,
                        "barebones": getattr(premise, 'barebones_form_2', premise.barebones_form),
                        "written_premise": "Therefore, " + premise.written_premise[:1].lower() + premise.written_premise[1:]
                    })

                    charts.append({
                        "title": f"Sub-Argument for {premise.number}",
                        "rows": subt_rows,
                        "level": depth
                    })
                    add_subtables(premise, depth + 1)

        add_subtables(self.root, 2)
        return charts
    
    def get_premise_types_list(self):
        return [self.format_premise_type(pt) for pt in PremiseType]
    
    # Helper methods
    def assign_numbers(self):
        """
        FIXED: Numbers direct premises of a node first, then recurses.
        This ensures High-Level Argument rows are always sequential (P1, P2...).
        """
        if not self.root:
            return
            
        self._counter = 1

        def process_level(node):
            # 1. Assign numbers to all immediate premises of this node
            for premise in node.premises:
                premise.number = f"P{self._counter}"
                self._counter += 1
            
            # 2. Now recurse into those premises to number their sub-arguments
            for premise in node.premises:
                process_level(premise)

        process_level(self.root)
            
    def find_node_by_number(self, node: Node, number: str) -> Node | None:
        if not node:
            return None

        if node.is_root and str(number) in ["0", "", "C"]:
            return node
        
        if getattr(node, "number", None) == number:
            return node
        
        for premise in node.premises:
            found = self.find_node_by_number(premise, number)
            if found:
                return found
        
        return None
    
    def format_premise_type(self, premise_type: PremiseType) -> str:
        if not premise_type: return ""
        return premise_type.name.replace('_', ' ').title()
        
    def parse_premise_type(self, label: str) -> PremiseType:
        enum_key = label.replace(' ', '_').upper()
        return PremiseType[enum_key]