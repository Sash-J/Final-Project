from flask import Blueprint, render_template, request, flash

auth = Blueprint("auth", __name__)


@auth.route("/login", methods=["GET", "POST"])
def login():
    return render_template("login.html")


@auth.route("/logout")
def logout():
    return "<p>Logout</p>"


@auth.route("/sign-up", methods=["GET", "POST"])
def sign_up():
    if request.method == "POST":
        email = request.form.get("email")
        firstName = request.form.get("firstName")
        password = request.form.get("password")
        confirmPassword = request.form.get("confirmPassword")

        if len(email) < 5:
            flash("Email must be at least 5 characters long", category="error")
        elif len(firstName) < 2:
            flash("First name must be at least 2 characters long", category="error")
        elif len(password) < 8:
            flash("Password must be at least 8 characters long", category="error")
        elif password != confirmPassword:
            flash("Passwords do not match", category="error")
        else:
            # add user to database
            flash("Account created successfully", category="success")

    return render_template("sign_up.html")
