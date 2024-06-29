const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const session = require('express-session'); // Import express-session
const fs = require('fs');
var mysql = require('mysql2'); 
const path = require('path');


const app = express();
const port = 6789;

app.use(cookieParser());
app.use(session({
    secret:'robert_Rboert',
    resave:false,
    saveUninitialized:false,
    cookie:{
        maxAge: null
    }})
);
app.set('view engine', 'ejs');
app.use(expressLayouts);
app.use(express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// https://expressjs.com/en/guide/using-middleware.html
//Middleware functions are functions that have access to the request object (req), 
//the response object (res), and the next middleware function in the application’s
// request-response cycle. The next middleware function is commonly denoted by a 
//variable named next.

//End the request-response cycle.
//folosită pentru a efectua anumite operațiuni înainte de a permite continuarea fluxului de execuție al unei cereri. 
function myMiddleware(req, res, next) {
    // collect user if avanable
    var user = "";
    if(req.session.user){
        user = req.session.user;
    }

    if(req.cookies['log-tries'] !== undefined){
        console.log(req.cookies['log-tries']);
    }

    res.locals["userlogged"] = user;

    // daca utilizatorul e banat
    if(req.cookies['banned'] !== undefined){
        res.render("banned");
    }

    next(); //permite continuarea fluxului de execuție al cererii
}

app.use('*', myMiddleware) // folosesc functia de middleware pentru toate rutele

// home credentials
let db_host = "localhost";
let db_name = "pw";
let db_user = "robert";
let db_password = "student";

// create database
let con = mysql.createConnection({
    host: db_host,
    user: db_user,
    password: db_password
});

// aici se creaza tabelele si se realizeaza conectiunea
con.connect(function(err) {
    if (err) throw err;
    console.log("Connected!");
});


function connectToDb(){
    // create connect to database cumparaturi
    con = mysql.createConnection({
        host: db_host,
        user: db_user,
        password: db_password,
        database: db_name
    });

    con.connect(function(err) {
    if (err) throw err;
    console.log("Connected to cumparaturi!");
    });
}


app.get('/', (req, res) => {
    var listaProduseExistente = [];

    if( con.config.database == db_name){
        con.query("SELECT * FROM produse", function (err, result, fields) {
            if (err) throw err;
            result.forEach((rawDataPacket) => {
                listaProduseExistente.push(rawDataPacket);
            });
            res.render("index", {"listaProduse" : listaProduseExistente});
        });
    }
    else
    {
        res.render("index", {"listaProduse" : listaProduseExistente});
    }
});

let rawIntrebari = fs.readFileSync('intrebari.json');
const listaIntrebari = JSON.parse(rawIntrebari)["intrebari"];
let rawUseri = fs.readFileSync('utilizatori.json');
const listaUtilizatori = JSON.parse(rawUseri);

app.get('/chestionar', (req, res) => {
	// în fișierul views/chestionar.ejs este accesibilă variabila 'intrebari' care conține vectorul de întrebări
	res.render('chestionar', {intrebari: listaIntrebari});
});

app.post('/rezultat-chestionar', (req, res) => {
    const jsonData = fs.readFileSync("intrebari.json", "utf-8");
    const obj = JSON.parse(jsonData);
    let nrRaspCorecte = 0;
    for (let i = 0; i < obj.intrebari.length; i++) {
        const intrebare = obj.intrebari[i];
        if(intrebare.variante[req.body[`raspuns-${i}`]] === intrebare.variante[intrebare.corect]){
            nrRaspCorecte++;
        }
    }
    console.log(nrRaspCorecte);
    res.render('rezultat-chestionar',{number:nrRaspCorecte});
});



app.get('/autentificare', (req, res) => {

    // sterg userul din sesiune cand se inchide pagina
    if(req.session.user){
        delete req.session.user;
    }

    // verificare eroare
    var eroare = "";
    if(req.cookies["mesajEroare"] != null){
        eroare = req.cookies["mesajEroare"];
    }

    res.clearCookie("mesajEroare");
    res.render('autentificare', {eroare: eroare});
});


app.post('/verificare-autentificare', (req, res) => {
    var body = req.body;
    let userObj = null;

    listaUtilizatori.forEach(element => {
        if(body.user == element.utilizator && body.password == element.parola){
            userObj = element;
            // parola nu trebuie trimisa
            delete userObj["parola"];
            return;
        }
    });

    if(userObj != null){
        res.clearCookie("mesajEroare");
        res.clearCookie("log-tries");
        // realizez conectiunea la baza de date
        connectToDb();

        // setam user in session
        req.session.user = userObj;
        // redirect to index
        res.redirect("/");
    }
    else{
        // cookie care zice cate incercari are
        if(req.cookies['log-tries'] === undefined){
            // setez durata un minut
            res.cookie("log-tries", 1, { maxAge: 1000 * 60});
        }
        else{
            res.cookie("log-tries", parseInt(req.cookies['log-tries']) + 1, { maxAge: 1000 * 60});

            // ban the user
            // use the middleware to redirect
            if(req.cookies['log-tries'] == 3){
                res.cookie("banned", true, {maxAge: 1000 * 60});
            }
        }

        console.log(req.cookies['log-tries']);


        res.cookie("mesajEroare", "Nume sau parola gresite!");
        res.redirect("/autentificare");
    }

});
app.get('/admin', (req, res) => {
    if(!req.session.user || req.session.user == ""){
        res.redirect("/");
    }

    if(req.session.user['rol'] != "ADMIN"){
        res.redirect("/");
    }

    res.render('admin');
});

app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.redirect('/');
        }
        res.clearCookie('connect.sid'); 
        res.redirect('/');
    });
});

app.get('/creare-db', (req, res) => {

    con.query("CREATE DATABASE IF NOT EXISTS " +db_name, function (err, result) {
        if (err) throw err;
        console.log("Baza de date creata!");
    });

    con = mysql.createConnection({
        host: db_host,
        user: db_user,
        password: db_password,
        database: db_name
    });

    con.connect(function(err) {
        if (err) throw err;
        console.log("Conectat la baza de date!");
        
        con.query("CREATE TABLE IF NOT EXISTS produse (id_produs INT NOT NULL AUTO_INCREMENT, nume_produs VARCHAR(255), pret DECIMAL(9, 2), img_src VARCHAR(255), PRIMARY KEY (id_produs))", function (err, result) {
            if (err) throw err;
            console.log("Tabelul produse creat!");
        });
    });
    
});


let listaProduse = [
    {
        "nume_produs":" Geacă",
        "pret": 200,
        "img_src": "geaca.webp"
    },
    {
        "nume_produs": "Hanorac",
        "pret": 150,
        "img_src": "hanorac.webp"
    },
    {
        "nume_produs": "Tricou",
        "pret": 100,
        "img_src": "tricou.webp"
    },
    {
        "nume_produs": "Cămașă",
        "pret": 180,
        "img_src": "camasa.png"
    },
    {
        "nume_produs": "Blugi",
        "pret": 110,
        "img_src": "blugi.png"
    },
    {
        "nume_produs": "Tricou1",
        "pret": 120,
        "img_src": "tricou1.webp"
    },
    {
        "nume_produs": "Tricou2",
        "pret": 130,
        "img_src": "tricou2.webp"
    }
];


app.get('/inserare-db', (req, res) => {
    // connect to the database (assume it is created)
    con = mysql.createConnection({
        host: db_host,
        user: db_user,
        password: db_password,
        database: db_name
    });

    // se verifica daca au fost deja introduse elemente
    var nrProduse = 0;
    con.query("SELECT COUNT(*) as cnt FROM produse", function (err, result, fields) {
        if (err) throw err;
        nrProduse = result[0]["cnt"];

        if(nrProduse == 0){
            // aici se introduc produsele in baza de date
            listaProduse.forEach((produs) => {
    
                let sql = "INSERT INTO produse (id_produs, nume_produs, pret, img_src) VALUES (null, ?, ?, ?)";
                con.query(sql, [produs.nume_produs, produs.pret, produs.img_src], function (err, result) {
                    if (err) throw err;
                    console.log("1 record inserted");
                });
    
            })
        }
    });
    // redirect spre /
    res.redirect("/");
});


app.post('/adaugare-cos', (req, res) => {
    if(req.body.id_produs){
        if(!req.session.cos){
            req.session.cos = [];
        }

        let ok = false;
        // verific daca exista id-ul in cos
        req.session.cos.forEach((obiect) => {
            if(obiect["id_produs"] == req.body.id_produs){
                obiect["nr_produse"] ++;
                ok = true;
                return;
            }
        });

        // daca nu exista id ul, il adaug
        if( ok === false){
            req.session.cos.push(
                { 
                    id_produs: req.body.id_produs,
                    nr_produse: 1
                }
            );
        }
    }
    res.redirect("/");
});


app.get('/vizualizare-cos', (req,res) => {
    // create lista produse cos
    var produseCos = [];
    var produseDB = [];

    // daca exista, atribui elementul din sesiune
    if(req.session.cos){
        produseCos = req.session.cos;
    }

    // extrage elemente din baza de date
    if( produseCos.length > 0 && con.config.database == db_name){
        // selectez toate produsele existente
        con.query("SELECT * FROM produse", function (err, result, fields) {
            console.log(produseCos);

            // verific daca se regaseste in lista mea
            result.forEach((subRes)=> {
                produseCos.forEach((articol) => {
                    if(articol["id_produs"] == subRes["id_produs"]){
                        articol["produs"] = subRes;
                        return;
                    }
                });
            });
            
            res.render("vizualizare-cos", {produse_cumparate:produseCos});
        });
    }
    else{
        res.render("vizualizare-cos", {produse_cumparate:[]});
    }
});


app.post('/verificare-adaugare-produs', (req, res) =>{
    // only admin access
    if(!req.session.user){
        res.redirect("/");
    }
    if(req.session.user['rol'] != "ADMIN"){
        res.redirect("/");
    }

    // get body params
    var nume_produs = req.body.nume_produs;
    var pret = req.body.pret;
    var img_src = req.body.img_src;

    var eroare = "";
    // verificari campuri
    if(nume_produs == "" || img_src == "")
    {
        eroare = "Toate câmpurile trebuie completate!";
    }

    if(eroare == ""){
        // adaug in baza de date

        let sql = "INSERT INTO produse (id_produs, nume_produs, pret, img_src) VALUES (null, ?, ?, ?)";
        con.query(sql, [nume_produs, pret, img_src], function (err, result) {
            if (err) throw err;
            console.log("1 record inserted");
            res.redirect('/');
        });
    }
    else{
        res.redirect('/admin');
    }

});

app.listen(port, () => console.log(`Serverul rulează la adresa http://localhost:${port}`));