from flask import Flask, render_template, redirect, url_for, request, jsonify
from node import *
from mantiq_map import *

app = Flask(__name__)

# Create an argument
mymap = MantiqMap()
root_node = Node("", "")
mymap.set_root(root_node)
# mymap.set_title("the  Impossibility  of Prime-Matter Without Physical Form ")

@app.route("/add_premise", methods=["POST"])
def add_premise():
    arg_num = request.form.get("arg_num")[1:] or 0
    mymap.add_subpremise(arg_num, '', '', PremiseType.SELF_EVIDENT)
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
    field = data['field']  # 'barebones' or 'written_premise'
    new_value = data['value']

    # Find the premise node by number
    print(f"{premise_number=}, {mymap.root=}")
    premise = mymap.find_node_by_number(mymap.root, premise_number)

    if premise:
        if field == 'written_premise':
            premise.written_premise = new_value
        elif field == 'barebones':
            premise.barebones_form = new_value
        elif field == 'barebones_2':
            premise.barebones_form_2 = new_value

    return redirect(url_for("editor"))

@app.route("/update_proposition_type", methods=['POST'])
def update_proposition_type():
    data = request.get_json()
    proposition_type = mymap.parse_premise_type(data['value'])
    premise_number = data['number']
    
    premise = mymap.find_node_by_number(mymap.root, premise_number)
    
    if premise:
        premise.premise_type = proposition_type
        
        if proposition_type == PremiseType.INFERENTIAL:
            mymap.add_subpremise(premise_number[1:], "", "", PremiseType.SELF_EVIDENT)
    
    return redirect(url_for("editor"))

@app.route("/create_new_argument", methods=['POST'])
def create_new_arg():
    global mymap
    global root
    
    root = Node()
    mymap = MantiqMap(root)
    mymap.set_title(request.get_json()['title'])
    
    return jsonify({"redirect": url_for("editor")})

@app.route("/editor")
def editor():    
    return render_template("index.html", argument_chart=mymap.get_chart_representation(), premise_types=mymap.get_premise_types_list())

@app.route("/")
def home():
    return render_template("home.html")

if __name__ == "__main__":
    app.run(debug=True)