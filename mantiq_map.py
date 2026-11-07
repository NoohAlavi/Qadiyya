from node import *

class MantiqMap:
    
    # Constructor
    def __init__(self, root=None):
        self.title = ""
        self.root = None
        # View state of the "Argument Tree" section in the editor:
        # None (follow the "tree opens by default" setting), "collapsed" or "expanded".
        self.tree_state = None
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
    
    def get_chart_representation(self, subargs_collapsed_by_default: bool = False) -> list:
        """Flatten the tree into tables for rendering.
        Each sub-argument table carries `collapsed` (what to show now) and `follows_default`
        (True while the user hasn't opened or closed it themselves)."""
        charts = []

        # =============== 1. HIGH-LEVEL ARGUMENT TABLE ===============
        high_level_rows = []
        for p in self.root.premises:
            high_level_rows.append({
                "number": p.number,
                "barebones": p.barebones["parent"],
                "barebones_key": "parent",
                "written_premise": p.written_premise,
                "premise_type": self.format_premise_type(p.metadata["premise_type"]),
                "annotations": p.metadata["annotations"]
            })
            
        high_level_rows.append({
            "number": "C",
            "barebones": self.root.barebones["parent"],
            "barebones_key": "parent",
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
                            "barebones": child.barebones["parent"],
                            "barebones_key": "parent",
                            "written_premise": child.written_premise,
                            "premise_type": self.format_premise_type(child.metadata["premise_type"]),
                            "annotations": child.metadata["annotations"]
                        })

                    subt_rows.append({
                        "number": premise.number,
                        "barebones": premise.barebones["child"],
                        "barebones_key": "child",
                        "written_premise": "Therefore, " + premise.written_premise[:1].lower() + premise.written_premise[1:]
                    })

                    charts.append({
                        "title": f"Sub-Argument for {premise.number}",
                        "rows": subt_rows,
                        "level": depth,
                        "collapsed": (premise.view_state == "collapsed"
                                      or (premise.view_state is None and subargs_collapsed_by_default)),
                        "follows_default": premise.view_state is None
                    })
                    add_subtables(premise, depth + 1)

        add_subtables(self.root, 2)
        return charts
    
    def get_premise_types_list(self):
        return [self.format_premise_type(pt) for pt in PremiseType]

    # ── Serialization ──────────────────────────────────────────
    def to_dict(self) -> dict:
        return {
            "title": self.title,
            "root": self.root.to_dict() if self.root else None,
            "tree_state": self.tree_state
        }

    @classmethod
    def from_dict(cls, d: dict) -> "MantiqMap":
        m = cls()
        m.title = d.get("title", "")
        if "tree_state" in d:
            m.tree_state = d["tree_state"] if d["tree_state"] in ("collapsed", "expanded") else None
        else:
            # Earlier format: a plain `tree_collapsed` true/false. Only a stored `true` was a
            # deliberate choice; `false` was the untouched default, so it now follows the setting.
            m.tree_state = "collapsed" if d.get("tree_collapsed") is True else None
        root_data = d.get("root")
        if root_data:
            root = Node.from_dict(root_data)
            m.root = root
        return m
    
    # Helper methods
    def assign_numbers(self):
        if not self.root:
            return
            
        self._counter = 1

        def process_level(node):
            for premise in node.premises:
                premise.number = f"P{self._counter}"
                self._counter += 1
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