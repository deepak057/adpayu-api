const { Likes, User, Comments, Posts, Tags } = require('../models');
const { to, ReE, ReS } = require('../services/util.service');
const { captureVideoPoster } = require('../services/app.service');

const fakeCommentsLike =  async function(req, res){
    let commentId = req.params.commentId, err, user = req.user, comment, n = req.query.n || 100, likes = [];
  	if (user.id === 1) {
  	  [err, comment] = await to(Comments.findOne({where: {id: commentId}}));	
  	
  	  for (let i = 0; i < n; i++) {
  		likes.push({
  			UserId: user.id,
  			CommentId: comment.id
  		})
  	  }

  	  Likes.bulkCreate(likes)
        .then((likes) => {
        	for(let i in likes) {
                user.addLikes(likes[i]);
                comment.addLikes(likes[i]);
        	}
            return ReS(res, {message:'Likes made successfully'}, 200);
        })
	
  	} else {
  		return ReE(res, {message:'Unathorized user'}, 401);
  	}
  	
}

module.exports.fakeCommentsLike = fakeCommentsLike;

const fakePostLike =  async function(req, res){
    let postId = req.params.postId, err, user = req.user, post, n = req.query.n || 100, likes = [];
  	if (user.id === 1) {
  	  [err, post] = await to(Posts.findOne({where: {id: postId}}));	
  	
  	  for (let i = 0; i < n; i++) {
  		likes.push({
  			UserId: user.id,
  			PostId: post.id
  		})
  	  }

  	  Likes.bulkCreate(likes)
        .then((likes) => {
        	for(let i in likes) { 
             user.addLikes(likes[i]);
             post.addLikes(likes[i]);
        	}
            return ReS(res, {message:'Likes made successfully'}, 200);
        })
	
  	} else {
  		return ReE(res, {message:'Unathorized user'}, 401);
  	}
  	
}

module.exports.fakePostLike = fakePostLike;


const captureScreenshots =  async function(req, res){
    if (req.user.id === 1) {

      const appRoot = require('app-root-path');

      // List all files in a directory in Node.js recursively in a synchronous fashion
       var walkSync = function(dir, filelist) {
              var path = path || require('path');
              var fs = fs || require('fs'),
                  files = fs.readdirSync(dir);
              filelist = filelist || [];
              files.forEach(function(file) {
                  if (fs.statSync(path.join(dir, file)).isDirectory()) {
                      filelist = walkSync(path.join(dir, file), filelist);
                  }
                  else {
                      
                    if(file.split('.').pop() === 'mp4') {
                      captureVideoPoster(file)
                    }
                  }
              });
              return filelist;
          };

          walkSync(appRoot+'/uploads/');
          return ReS(res, {message:'Screenshots are being taken.'}, 200);
    } else {
      return ReE(res, {message:'Unathorized user'}, 401);
    }
}

module.exports.captureScreenshots = captureScreenshots;

const putDefaultTagInAllPosts =  async function(req, res){
    if (req.user.id === 1) {
      let defaultTagName = 'general', defaultTag;

       [err, defaultTag] = await to(Tags.find({where: {name: defaultTagName}}));
       if(err) return ReE(res, err, 422);

      Posts.findAll({
        include: [
          {
            model: Tags
          }
        ]
      })
        .then((posts) => {

            for(let i in posts) {
              if (posts[i].Tags) {
                let defaultTagFound = false
                for(let j in posts[i].Tags) {
                  if (posts[i].Tags[j].id === defaultTag.id) {
                    defaultTagFound = true
                  }
                }
                if (!defaultTagFound) {
                  posts[i].addTags(defaultTag)
                }
              }
            }

            return ReS(res, {message:'Default tag is being added to all the posts.'}, 200);

        })
      
    } else {
      return ReE(res, {message:'Unathorized user'}, 401);
    }
}

module.exports.putDefaultTagInAllPosts = putDefaultTagInAllPosts;

const importNames =  async function(req, res){
    if (req.user.id === 1) {
      
      const appRoot = require('app-root-path');
      const csv = require('csv-parser');  
      const fs = require('fs');
      const authService       = require('../services/auth.service');
      const TagsController   = require('./tags.controller');
      let CSVPath = appRoot + '/uploads/Indian-Female-Names.csv'
      
      let helpers = {
        surNames: ["Acharya", "Asan", "Abbott", "Ahuja", "Arora", "Adiga", "Ahluwalia", "Anand", "Banerjee", "Bhat", "Bhattathiri", "Bhattacharya", "Bandyopadhyay", "Chattopadhyay", "Chopra: ", "Chaturvedi", "Chandra", "Chakyar", "Devar", "Dholia", "Dhar", "Deshmukh", "Desai", "Dhawan", "Dhirwan", "Dubashi", "Dwivedi", "Embranthiri", "Emani", "Gandhi", "Gill", "Iyengar", "Iyer", "Jha", "Jain", "Joshi", "Jindal", "Kakkar", "Kapoor", "Kaniyar", "Khanna", "See Also", "Khatri", "Kaviraj", "Kori", "Kocchar", "Lal", "Mahajan", "Mahto", "Nayar", "Nagarajan", "Nai", "Odda", "Pamireddy", "Qassab", "Rai", "Sachdev", "Trivedi: ", "Undirmare", "Velama", "Varma", "Telaga", "Venkatesh", "Vellala", "Verma", "Waghdare", "Warsi", "Yadav", "Zacharias", "Zaveri", "Zutshi", "Acharya", "Agarwal", "Agate", "Aggarwal", "Agrawal", "Ahluwalia", "Ahuja", "Amble", "Anand", "Andra", "Anne", "Apte", "Arora", "Arya", "Atwal", "Aurora", "Babu", "Badal", "Badami", "Bahl", "Bahri", "Bail", "Bains", "Bajaj", "Bajwa", "Bakshi", "Bal", "Bala", "Bala", "Balakrishnan", "Balan", "Balasubramanian", "Balay", "Bali", "Bandi", "Banerjee", "Banik", "Bansal", "Barad", "Barad", "Baral", "Baria", "Barman", "Basak", "Bassi", "Basu", "Bath", "Batra", "Batta", "Bava", "Bawa", "Bedi", "Behl", "Ben", "Bera", "Bhagat", "Bhakta", "Bhalla", "Bhandari", "Bhardwaj", "Bhargava", "Bhasin", "Bhat", "Bhatia", "Bhatnagar", "Bhatt", "Bhattacharyya", "Bhatti", "Bhavsar", "Bir", "Biswas", "Boase", "Bobal", "Bora", "Bora", "Borah", "Borde", "Borra", "Bose", "Brahmbhatt", "Brar", "Buch", "Buch", "Bumb", "Butala", "Chacko", "Chad", "Chada", "Chadha", "Chahal", "Chakrabarti", "Chakraborty", "Chana", "Chand", "Chanda", "Chander", "Chandra", "Chandran", "Char", "Chatterjee", "Chaudhari", "Chaudhary", "Chaudhry", "Chaudhuri", "Chaudry", "Chauhan", "Chawla", "Cheema", "Cherian", "Chhabra", "Chokshi", "Chopra", "Choudhary", "Choudhry", "Choudhury", "Chowdhury", "Comar", "Contractor", "D’Alia", "Dada", "Dalal", "Dani", "Dar", "Dara", "Dara", "Das", "Dasgupta", "Dash", "Dass", "Date", "Datta", "Dave", "Dayal", "De", "Deep", "Deo", "Deol", "Desai", "Deshmukh", "Deshpande", "Devan", "Devi", "Dewan", "Dey", "Dhaliwal", "Dhar", "Dhar", "Dhawan", "Dhillon", "Dhingra", "Din", "Divan", "Dixit", "Doctor", "Dora", "Doshi", "Dua", "Dube", "Dubey", "Dugal", "Dugar", "Dugar", "Dutt", "Dutta", "Dyal", "Edwin", "Gaba", "Gade", "Gala", "Gandhi", "Ganesan", "Ganesh", "Ganguly", "Gara", "Garde", "Garg", "Gera", "Ghose", "Ghosh", "Gill", "Goda", "Goel", "Gokhale", "Gola", "Gole", "Golla", "Gopal", "Goswami", "Gour", "Goyal", "Grewal", "Grover", "Guha", "Gulati", "Gupta", "Halder", "Handa", "Hans", "Hari", "Hayer", "Hayre", "Hegde", "Hora", "Issac", "Iyengar", "Iyer", "Jaggi", "Jain", "Jani", "Jayaraman", "Jha", "Jhaveri", "Johal", "Joshi", "Kadakia", "Kade", "Kakar", "Kala", "Kala", "Kala", "Kale", "Kalita", "Kalla", "Kamdar", "Kanda", "Kannan", "Kant", "Kapadia", "Kapoor", "Kapur", "Kar", "Kara", "Karan", "Kari", "Karnik", "Karpe", "Kashyap", "Kata", "Kaul", "Kaur", "Keer", "Keer", "Khalsa", "Khanna", "Khare", "Khatri", "Khosla", "Khurana", "Kibe", "Kohli", "Konda", "Korpal", "Koshy", "Kota", "Kothari", "Krish", "Krishna", "Krishnamurthy", "Krishnan", "Kulkarni", "Kumar", "Kumer", "Kunda", "Kurian", "Kuruvilla", "Lad", "Lad", "Lal", "Lala", "Lall", "Lalla", "Lanka", "Lata", "Loke", "Loyal", "Luthra", "Madan", "Madan", "Magar", "Mahajan", "Mahal", "Maharaj", "Majumdar", "Malhotra", "Mall", "Mallick", "Mammen", "Mand", "Manda", "Mandal", "Mander", "Mane", "Mangal", "Mangat", "Mani", "Mani", "Mann", "Mannan", "Manne", "Master", "Mishra", "Purohit", "Raj", "Raja", "Rajagopal", "Rajagopalan", "Rajan", "Raju", "Ram", "Rama", "Ramachandran", "Ramakrishnan", "Raman", "Ramanathan", "Ramaswamy", "Ramesh", "Rana", "Randhawa", "Ranganathan", "Rao", "Rastogi", "Ratta", "Rattan", "Ratti", "Rau", "Raval", "Ravel", "Ravi", "Ray", "Reddy", "Rege", "Rout", "Roy", "Sabharwal", "Sachar", "Sachdev", "Sachdeva", "Sagar", "Saha", "Sahni", "Sahota", "Saini", "Salvi", "Sama", "Sami", "Sampath", "Samra", "Sandal", "Sandhu", "Sane", "Sangha", "Sanghvi", "Sani", "Sankar", "Sankaran", "Sant", "Saraf", "Saran", "Sarin", "Sarkar", "Sarma", "Sarna", "Sarraf", "Sastry", "Sathe", "Savant", "Sawhney", "Saxena", "Sehgal", "Sekhon", "Sem", "Sen", "Sengupta", "Seshadri", "Seth", "Sethi", "Setty", "Sha", "Shah", "Shan", "Shankar", "Shanker", "Sharaf", "Sharma", "Shenoy", "Shere", "Sheth", "Shetty", "Shroff", "Shukla", "Sibal", "Sidhu", "Singh", "Singhal", "Sinha", "Sodhi", "Solanki", "Som", "Soman", "Soni", "Sood", "Sridhar", "Srinivas", "Srinivasan", "Srivastava", "Subramaniam", "Subramanian", "Sule", "Sundaram", "Sunder", "Sur", "Sura", "Suresh", "Suri", "Swaminathan", "Swamy", "Tailor", "Tak", "Talwar", "Tandon", "Taneja", "Tank", "Tara", "Tata", "Tella", "Thaker", "Thakkar", "Thakur", "Thaman", "Tiwari", "Toor", "Tripathi", "Trivedi", "Upadhyay", "Uppal", "Vaidya", "Vala", "Varghese", "Varkey", "Varma", "Varty", "Varughese", "Vasa", "Venkataraman", "Venkatesh", "Verma", "Vig", "Virk", "Viswanathan", "Vohra", "Vora", "Vyas", "Wable", "Wadhwa", "Wagle", "Wali", "Wali", "Walia", "Walla", "Warrior", "Wason", "Yadav", "Yogi", "Yohannan", "Zacharia", "Zachariah"],
        getFirstLastName: function (name) {
          let n = name.replace(".sh", "").replace("@", "").replace("/", "").replace("smt", "").replace("smt.", "").replace("s/o", "").replace("r/o", "").replace("d/o", "").trim().split(" ");
          n = n.filter(function (el) {
            return el !== null && el !== undefined && el !== ' ';
          });
          let first, last;
          if (n.length == 2) {
            first = n[0];
            last = n[1];
          } else if (n.length > 2) {
              first = n[0];
              for (let i = 1; i < n.length; i++) {
                //if (n[i] !== 'undefined') {
                  last += n[i] + ' '
                //}
              }
              last = last.trim()
          } else {
            first = n[0];
            last =  this.surNames[Math.floor(Math.random() * this.surNames.length)];
          }
          first = this.titleCase(first.replace("undefined", "").replace("  ", " "));
          last = this.titleCase(last.replace("undefined", "").replace("  ", " "));
          return {
            first: first.trim(),
            last: last.trim()
          }
        },
        makeid: function (length) {
           var result           = '';
           var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
           var charactersLength = characters.length;
           for ( var i = 0; i < length; i++ ) {
              result += characters.charAt(Math.floor(Math.random() * charactersLength));
           }
           return result;
        },
        getEmail: function (name) {
          let n = (name.first + name.last).replace(" ", "");
          let suffix = "." + this.makeid(8) + ".svanq";
          let email = (n + suffix + '@gmail.com').toLowerCase();
          if (this.validateEmail(email)) {
            return email
          } else {
            const uniqid = require('uniqid');
            return  this.makeid(10) + "." + uniqid() + ".svanq@gmail.com";  
          }

        },
        titleCase: function (str) {
            var splitStr = str.toLowerCase().split(' ');
             for (var i = 0; i < splitStr.length; i++) {
                 // You do not need to check if i is larger than splitStr length, as your for does that for you
                 // Assign it back to the array
                 splitStr[i] = splitStr[i].charAt(0).toUpperCase() + splitStr[i].substring(1);     
             }
             // Directly return the joined string
             return splitStr.join(' ');
        },
        validateEmail : function (email) {
          var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
          return re.test(email);
        }
      }
      fs.createReadStream(CSVPath)  
      .pipe(csv())
      .on('data', (row) => {
        //console.log(row.name);
        if (row.name) {
          let user = {}
          let name = helpers.getFirstLastName(row.name);
          user.first = name.first;
          user.last = name.last;
          user.email = helpers.getEmail(name);
          user.password = helpers.makeid(10);
          user.location = "IN";
          user.systemCreatedUser = true;
          let gender = '';
          if (row.gender) {
            if (row.gender === 'm') {
              gender = 'male';
            } else if (row.gender === 'f') {
              gender =  'female'
            } else {
              gender = 'other'
            }
          }
          user.gender = gender;

          let err, userObj;

          authService.createUser(user)
            .then ((userObj) => {
               //associate this user with default tag
              //TagsController.associateWithDefaultTag(userObj);

            })

            console.log("User created- " + JSON.stringify(user) + '\n');
            
            }
      })
      .on('end', () => {
        return ReS(res, {message:'Successfully imported users.'});
        console.log('CSV file successfully processed');
      });


      // return ReS(res, {message:'Default tag is being added to all the posts.'}, 200);
        
    
      // return ReE(res, {message:'Unathorized user'}, 401);
    }    
}


module.exports.importNames = importNames;