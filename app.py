from flask import Flask, render_template, redirect, url_for, request, jsonify
from node import *
from mantiq_map import *

app = Flask(__name__)

# Create an argument
mymap = MantiqMap()
root_node = Node("", "")
mymap.set_root(root_node)

@app.route("/add_premise", methods=["POST"])
def add_premise():
    arg_num = request.form.get("arg_num")[1:] or 0
    mymap.add_subpremise(arg_num, '. . .', '. . .', PremiseType.SELF_EVIDENT)
    return redirect(url_for("editor"))

@app.route("/delete_premise", methods=["POST"])
def delete_premise():
    premise_num = request.form.get("premise_num")
    if premise_num:
        mymap.delete_premise(premise_num)
    
    return redirect(url_for("editor"))

@app.route("/update_premise", methods=["POST"])
def update_premise():
    data = request.get_json()
    premise_number = data['number'] if data['number'] else 0
    field = data['field']        # 'barebones_parent', 'barebones_child', or 'written_premise'
    new_value = data['value']

    print(f"{premise_number=}, {mymap.root=}")
    premise = mymap.find_node_by_number(mymap.root, premise_number)

    if premise:
        if field == 'written_premise':
            premise.written_premise = new_value
        elif field == 'barebones_parent':
            premise.barebones["parent"] = new_value
        elif field == 'barebones_child':
            premise.barebones["child"] = new_value

    is_inferential = bool(premise and premise.premises)
    return jsonify({"ok": True, "reload": is_inferential and field == 'written_premise'})

@app.route("/update_proposition_type", methods=['POST'])
def update_proposition_type():
    data = request.get_json()
    proposition_type = mymap.parse_premise_type(data['value'])
    premise_number = data['number']
    
    premise = mymap.find_node_by_number(mymap.root, premise_number)
    
    needs_reload = False
    if premise:
        premise.premise_type = proposition_type
        
        # If the proposition is inferential, then generate a sub-argument with two premises, and refresh the page
        if proposition_type == PremiseType.INFERENTIAL:
            mymap.add_subpremise(premise_number[1:], ". . .", ". . .", PremiseType.SELF_EVIDENT)
            mymap.add_subpremise(premise_number[1:], ". . .", ". . .", PremiseType.SELF_EVIDENT)
            needs_reload = True
    
    return jsonify({"reload": needs_reload})

@app.route("/create_new_argument", methods=['POST'])
def create_new_arg():
    global mymap

    data = request.get_json()
    title = data.get("title", "Untitled Argument")

    mymap = create_example_argument()
    mymap.set_title(title)

    return jsonify({"redirect": url_for("editor")})

def create_example_argument():
    global root
    
    root = Node(
        barebones_form="Therefore, C is B",
        written_premise="Therefore, [. . .]",
        premise_type=PremiseType.INFERENTIAL
    )
    root.is_root = True

    mymap = MantiqMap(root)
    mymap.set_title("Starter Argument")

    # P1: All A is B
    p1 = Node(
        barebones_form="All A is B",
        written_premise=". . .",
        premise_type=PremiseType.SELF_EVIDENT
    )

    # P2: C is A
    p2 = Node(
        barebones_form="C is A",
        written_premise=". . .",
        premise_type=PremiseType.SELF_EVIDENT
    )

    # attach children to root
    root.premises = [p1, p2]
    mymap.assign_numbers()

    return mymap

@app.route("/editor")
def editor():    
    return render_template("index.html", argument_chart=mymap.get_chart_representation(), premise_types=mymap.get_premise_types_list())

@app.route("/arguments")
def arguments():    
    return render_template("arguments.html")

@app.route("/")
def home():
    return render_template("home.html")

if __name__ == "__main__":
    app.run(debug=True)