import os
import json
import uuid
from flask import Flask, render_template, redirect, url_for, request, jsonify, session, Response
from node import *
from mantiq_map import *

app = Flask(__name__)

# ── Secret key for Flask sessions ──────────────────────────────
# In production, set this via an environment variable.
app.secret_key = os.environ.get("SECRET_KEY", "qaḍiyya-dev-secret-change-in-prod")

# ── Session file storage ────────────────────────────────────────
SESSIONS_DIR = os.path.join(os.path.dirname(__file__), "sessions")
os.makedirs(SESSIONS_DIR, exist_ok=True)


# ══════════════════════════════════════════════════════════════════
#  SESSION / PERSISTENCE HELPERS
# ══════════════════════════════════════════════════════════════════

def session_file() -> str:
    """Return the JSON file path for the current browser session."""
    if "sid" not in session:
        session["sid"] = str(uuid.uuid4())
    return os.path.join(SESSIONS_DIR, f"{session['sid']}.json")


def load_user_data() -> dict:
    """
    Load the full user data dict from disk.
    Structure:
    {
        "projects": {
            "<project_id>": { "title": "...", "root": { ...Node dict... } },
            ...
        },
        "current_project": "<project_id>"
    }
    If no file exists yet, start with no projects.
    """
    path = session_file()
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    data = {
        "projects": {},
        "current_project": None
    }
    save_user_data(data)
    return data


def save_user_data(data: dict):
    """Write the user data dict to disk."""
    path = session_file()
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def get_current_map() -> MantiqMap:
    """Return the MantiqMap for the user's currently active project."""
    data = load_user_data()
    project_id = data["current_project"]
    project_dict = data["projects"][project_id]
    return MantiqMap.from_dict(project_dict)


def save_current_map(mymap: MantiqMap):
    """Persist a MantiqMap back into the user's current project slot."""
    data = load_user_data()
    project_id = data["current_project"]
    data["projects"][project_id] = mymap.to_dict()
    save_user_data(data)


# ══════════════════════════════════════════════════════════════════
#  STARTER ARGUMENT FACTORY
# ══════════════════════════════════════════════════════════════════

def create_example_argument() -> MantiqMap:
    root = Node(
        barebones_form="Therefore, C is B",
        written_premise="Therefore, [. . .]",
        premise_type=PremiseType.INFERENTIAL
    )
    root.is_root = True

    mymap = MantiqMap()
    mymap.root = root
    mymap.title = ""

    p1 = Node(barebones_form="All A is B", written_premise=". . .", premise_type=PremiseType.SELF_EVIDENT)
    p2 = Node(barebones_form="C is A",     written_premise=". . .", premise_type=PremiseType.SELF_EVIDENT)
    root.premises = [p1, p2]

    mymap.assign_numbers()
    return mymap


# ══════════════════════════════════════════════════════════════════
#  ROUTES — EDITOR MUTATIONS
# ══════════════════════════════════════════════════════════════════

@app.route("/add_premise", methods=["POST"])
def add_premise():
    mymap = get_current_map()
    arg_num = request.form.get("arg_num")[1:] or 0
    mymap.add_subpremise(arg_num, '. . .', '. . .', PremiseType.SELF_EVIDENT)
    save_current_map(mymap)
    return redirect(url_for("editor"))


@app.route("/delete_premise", methods=["POST"])
def delete_premise():
    mymap = get_current_map()
    premise_num = request.form.get("premise_num")
    if premise_num:
        mymap.delete_premise(premise_num)
    save_current_map(mymap)
    return redirect(url_for("editor"))


@app.route("/update_premise", methods=["POST"])
def update_premise():
    data = request.get_json()
    premise_number = data['number'] if data['number'] else 0
    field = data['field']
    new_value = data['value']

    mymap = get_current_map()
    premise = mymap.find_node_by_number(mymap.root, premise_number)

    if premise:
        if field == 'written_premise':
            premise.written_premise = new_value
        elif field == 'barebones_parent':
            premise.barebones["parent"] = new_value
        elif field == 'barebones_child':
            premise.barebones["child"] = new_value

    save_current_map(mymap)

    is_inferential = bool(premise and premise.premises)
    return jsonify({"ok": True, "reload": is_inferential and field == 'written_premise'})


@app.route("/update_proposition_type", methods=['POST'])
def update_proposition_type():
    data = request.get_json()
    premise_number = data['number']

    mymap = get_current_map()
    proposition_type = mymap.parse_premise_type(data['value'])
    premise = mymap.find_node_by_number(mymap.root, premise_number)

    needs_reload = False
    if premise:
        premise.premise_type = proposition_type
        if proposition_type == PremiseType.INFERENTIAL:
            mymap.add_subpremise(premise_number[1:], ". . .", ". . .", PremiseType.SELF_EVIDENT)
            mymap.add_subpremise(premise_number[1:], ". . .", ". . .", PremiseType.SELF_EVIDENT)
            needs_reload = True

    save_current_map(mymap)
    return jsonify({"reload": needs_reload})


# ══════════════════════════════════════════════════════════════════
#  ROUTES — PROJECT MANAGEMENT
# ══════════════════════════════════════════════════════════════════

@app.route("/create_new_argument", methods=['POST'])
def create_new_arg():
    data = request.get_json()
    title = data.get("title", "")

    new_map = create_example_argument()
    new_map.set_title(title)

    user_data = load_user_data()
    project_id = str(uuid.uuid4())
    user_data["projects"][project_id] = new_map.to_dict()
    user_data["current_project"] = project_id
    save_user_data(user_data)

    return jsonify({"redirect": url_for("editor")})


@app.route("/switch_project", methods=['POST'])
def switch_project():
    data = request.get_json()
    project_id = data.get("project_id")

    user_data = load_user_data()
    if project_id in user_data["projects"]:
        user_data["current_project"] = project_id
        save_user_data(user_data)
        return jsonify({"redirect": url_for("editor")})

    return jsonify({"error": "Project not found"}), 404


@app.route("/rename_project", methods=['POST'])
def rename_project():
    data = request.get_json()
    project_id = data.get("project_id")
    new_title = data.get("title", "")

    user_data = load_user_data()
    if project_id not in user_data["projects"]:
        return jsonify({"error": "Project not found"}), 404

    user_data["projects"][project_id]["title"] = new_title
    save_user_data(user_data)
    return jsonify({"ok": True})


@app.route("/delete_project", methods=['POST'])
def delete_project():
    data = request.get_json()
    project_id = data.get("project_id")

    user_data = load_user_data()
    projects = user_data["projects"]

    if project_id not in projects:
        return jsonify({"error": "Project not found"}), 404

    del projects[project_id]

    # If we deleted the active project, switch to first remaining or clear it
    if user_data["current_project"] == project_id:
        user_data["current_project"] = next(iter(projects)) if projects else None

    save_user_data(user_data)
    return jsonify({"ok": True})


# ══════════════════════════════════════════════════════════════════
#  ROUTES — EXPORT
# ══════════════════════════════════════════════════════════════════

@app.route("/export_json")
def export_json():
    user_data = load_user_data()
    current_id = user_data.get("current_project")
    if not current_id or current_id not in user_data["projects"]:
        return redirect(url_for("arguments"))

    project = user_data["projects"][current_id]
    title = project.get("title") or "argument"
    filename = title.lower().replace(" ", "_") + ".json"

    return Response(
        json.dumps(project, ensure_ascii=False, indent=2),
        mimetype="application/json",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


def _build_export_html(mymap: MantiqMap) -> str:
    """Render the clean export template to an HTML string."""
    return render_template(
        "export.html",
        argument_chart=mymap.get_chart_representation(),
        title=mymap.title
    )


@app.route("/export_image")
def export_image():
    user_data = load_user_data()
    current_id = user_data.get("current_project")
    if not current_id or current_id not in user_data["projects"]:
        return redirect(url_for("arguments"))

    try:
        from weasyprint import HTML
        import io

        mymap = get_current_map()
        html_str = _build_export_html(mymap)
        title = mymap.title or "argument"
        filename = title.lower().replace(" ", "_") + ".png"

        # WeasyPrint renders to PDF; we convert the first page to PNG via Pillow
        from weasyprint import HTML as WP_HTML
        pdf_bytes = WP_HTML(string=html_str, base_url=request.host_url).write_pdf()

        # Convert PDF → PNG using pdf2image
        from pdf2image import convert_from_bytes
        from PIL import Image, ImageChops
        images = convert_from_bytes(pdf_bytes, dpi=150)

        # Crop the parchment-coloured margins off each page before stacking
        # so adjacent pages don't produce a double-margin gap.
        parchment = (245, 240, 232)

        def crop_margins(img):
            bg = Image.new("RGB", img.size, parchment)
            diff = ImageChops.difference(img, bg)
            bbox = diff.getbbox()
            if bbox:
                # Add a small uniform padding back so content isn't flush to the edge
                pad = 24
                w, h = img.size
                bbox = (
                    max(0,   bbox[0] - pad),
                    max(0,   bbox[1] - pad),
                    min(w,   bbox[2] + pad),
                    min(h,   bbox[3] + pad),
                )
                return img.crop(bbox)
            return img

        cropped = [crop_margins(img) for img in images]

        # Stack all cropped pages vertically into one image
        total_height = sum(img.height for img in cropped)
        max_width = max(img.width for img in cropped)
        combined = Image.new("RGB", (max_width, total_height), parchment)
        y = 0
        for img in cropped:
            combined.paste(img, (0, y))
            y += img.height

        buf = io.BytesIO()
        combined.save(buf, format="PNG")
        buf.seek(0)

        return Response(
            buf.read(),
            mimetype="image/png",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    except ImportError as e:
        return f"Missing dependency: {e}. Run: pip install weasyprint pdf2image pillow", 500


@app.route("/export_pdf")
def export_pdf():
    user_data = load_user_data()
    current_id = user_data.get("current_project")
    if not current_id or current_id not in user_data["projects"]:
        return redirect(url_for("arguments"))

    try:
        from weasyprint import HTML
        import io

        mymap = get_current_map()
        html_str = _build_export_html(mymap)
        title = mymap.title or "argument"
        filename = title.lower().replace(" ", "_") + ".pdf"

        buf = io.BytesIO()
        HTML(string=html_str, base_url=request.host_url).write_pdf(buf)
        buf.seek(0)

        return Response(
            buf.read(),
            mimetype="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    except ImportError as e:
        return f"Missing dependency: {e}. Run: pip install weasyprint", 500


# ══════════════════════════════════════════════════════════════════
#  ROUTES — PAGES
# ══════════════════════════════════════════════════════════════════

@app.route("/editor")
def editor():
    user_data = load_user_data()
    if not user_data.get("current_project") or not user_data["projects"]:
        return redirect(url_for("arguments"))
    mymap = get_current_map()
    return render_template(
        "index.html",
        argument_chart=mymap.get_chart_representation(),
        premise_types=mymap.get_premise_types_list()
    )


@app.route("/arguments")
def arguments():
    user_data = load_user_data()
    projects = user_data["projects"]
    current_id = user_data.get("current_project")

    project_list = [
        {
            "id": pid,
            "title": pdata.get("title", ""),
            "is_current": pid == current_id
        }
        for pid, pdata in projects.items()
    ]

    return render_template("arguments.html", projects=project_list, current_id=current_id)


@app.route("/")
def home():
    return render_template("home.html")


if __name__ == "__main__":
    app.run(debug=True)