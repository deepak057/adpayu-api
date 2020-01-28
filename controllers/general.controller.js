const { Likes, User, Comments, Posts, Tags, Videos } = require('../models');
const { to, ReE, ReS, uniqeFileName } = require('../services/util.service');
const { captureVideoPoster, optimizeVideoFile, optimizeImage } = require('../services/app.service');
const Sequelize = require('sequelize');
const op = Sequelize.Op;
const appRoot = require('app-root-path');
const fs = require('fs');
const path = require('path'); 

const fakeCommentsLike =  async function(req, res){
    let commentId = req.params.commentId, err, user = req.user, comment, n = parseInt(req.query.n || 100 ), likes = [], users = [];
  	if (user.id === 1) {

      [err, comment] = await to(Comments.findOne({where: {id: commentId}}));  

      //get n random and system created users
      [err, users] = await to(User.findAll({where: {systemCreatedUser: true}, order: Sequelize.literal('rand()'), limit: n}));  

  	  for (let i = 0; i < n; i++) {
    		likes.push({
    			UserId: users[i].id,
    			CommentId: comment.id
    		})
  	  }

  	  Likes.bulkCreate(likes)
        .then((likes) => {
        	for(let i in likes) {
                users[i].addLikes(likes[i]);
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
    let postId = req.params.postId, err, user = req.user, post, n = parseInt(req.query.n || 100), likes = [], users = [];
  	if (user.id === 1) {
  	  
      [err, post] = await to(Posts.findOne({where: {id: postId}}));	
  	 
      //get n random and system created users
      [err, users] = await to(User.findAll({where: {systemCreatedUser: true}, order: Sequelize.literal('rand()'), limit: n}));  

  	  for (let i = 0; i < n; i++) {
    		likes.push({
    			UserId: users[i].id,
    			PostId: post.id
    		})
  	  }

  	  Likes.bulkCreate(likes)
        .then((likes) => {
        	for(let i in likes) { 
             users[i].addLikes(likes[i]);
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

      // List all files in a directory in Node.js recursively in a synchronous fashion
       var walkSync = function(dir, filelist) {
              var path = path || require('path');
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
      
      const csv = require('csv-parser');  
      const authService       = require('../services/auth.service');
      const TagsController   = require('./tags.controller');
      let CSVPath = appRoot + '/uploads/csv-zusammenfuehren.de_77c89p8g.csv'
      
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
          const uniqid = require('uniqid');
          let n = (name.first + name.last).replace(" ", "");
          let suffix = "." + this.makeid(8) + ".svanq";
          let email = (n + suffix + '@gmail.com').toLowerCase();
          if (this.validateEmail(email)) {
            return email
          } else {
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

    } else {
      return ReE(res, {message:'Unathorized user'}, 401);
    }
}


module.exports.importNames = importNames;

const putRandomProfilePics =  async function(req, res){
      if (req.user.id === 1) {
        const https = require('https');
        const request = require('request');
        let gender = req.query.gender || 'female';
        let limit = req.query.limit || 500;
        let data='';

        let httpOptions = {
          host: 'randomuser.me',
          path: '/api/?results='+limit+'&gender='+gender,
          method: 'GET',
        }

        let get_req = https.request(httpOptions, function(resp) {
        resp.on('data', function (chunk) {
             data += chunk;
        });
          resp.on('end', () => {
            let json = JSON.parse(data)
            if (json.results.length) {
                User.findAll({
                    where: {
                    systemCreatedUser: true, 
                    pic: '',
                    gender: gender,
                  },
                })
                  .then((users) => {
                    if (users) {
                      for (let i in users) {
                          let randomuser = json.results[i];
                          if (randomuser) {
                              let filename = uniqeFileName(randomuser.picture.large, users[i]);
                              let picPath = appRoot+'/uploads/'+filename;
                              request.head(randomuser.picture.large, function(err, res, body){
                                request(randomuser.picture.large).pipe(fs.createWriteStream(picPath)).on('close', function () {
                                  console.log('Pic downloaded....' + picPath)
                                  users[i].pic = filename;
                                  users[i].save()
                                    .then ((user) => {
                                        console.log("New pic for user "+ user.id + " is "+ user.pic);
                                    })
                                })
                              });
                          }
                         
                      }
                      return ReS(res, {message:'Profile pictures are being added.'});
                    }
                  })
            }
          })
          resp.on('error', (err) => {
            console.log(err)
          })
        });

        get_req.write('');
        get_req.end();

        

      } else {
        return ReE(res, {message:'Unathorized user'}, 401);
    }

}

module.exports.putRandomProfilePics = putRandomProfilePics;

const moveContentToS3 = async function (req, res) {

  if (req.user.id === 1) {
    var level = require('level')
    , s3sync = require('s3-sync-aws')
    , readdirp = require('readdirp')
    , dir = req.query.dir || '';
   
    // To cache the S3 HEAD results and speed up the
    // upload process. Usage is optional.
    var db = level(appRoot + '/uploads/cache')
     
    var files = readdirp(appRoot+ '/uploads/' + dir, {
        root: appRoot+ '/uploads/'
      , directoryFilter: ['!.git', '!cache']
    })
     
    // Takes the same options arguments as `aws-sdk`,
    // plus some additional options listed above
    var uploader = s3sync(db, {
        key: process.env.AWS_ACCESS_KEY
      , secret: process.env.AWS_SECRET
      , bucket: process.env.AWS_S3_BUCKET_NAME
      , concurrency: 16
      , prefix : dir
    }).on('data', function(file) {
      console.log(file.fullPath + ' -> ' + file.url)
    })
     
    files.pipe(uploader);
    return ReS(res, {message: 'Content is being sync with S3 bucket.'});
  } else {
    return ReE(res, {message:'Unathorized user'}, 401);
  }
}

module.exports.moveContentToS3 = moveContentToS3;


/*
* this function changes the existing post-comment association
* and associate the given post with the given Post
*/

const changeCommentAssociation = async function (req, res) {
    if (req.user.id === 1) {
      try {
        let commentId = req.params.commentId;
        let newPostId = req.query.postId;
        const { NOTIFICATIONS } = require('../config/app-constants');
        const NotificationsController   = require('./notifications.controller');
        const CommentsController   = require('./comments.controller');

        let deletePreviousNotification = function (comment, currentPost) {
          let noti = CommentsController.getNotification(commentId, currentPost.id, currentPost.type)
          NotificationsController.remove(noti, comment.UserId, currentPost.UerId)
        }

        let sendNotification = function (comment, currentPost) {

          // delete previous notification that was 
          // sent to the owner of current post
          // when this comment was posted there
          deletePreviousNotification(comment, currentPost)

          /*
          * Send notification to comment owner about 
          * the change in comment association
          */
          let noti = {
            type: NOTIFICATIONS.types.COMMENT_ASSOCIATION_CHANGED,
            meta: JSON.stringify({
              commentId: parseInt(commentId),
              postId: parseInt(newPostId),
            })
          }
          return NotificationsController.create(noti, comment.UserId, comment.UserId)
        }

        Comments.find({
          where: {
            id: commentId
          }
        })
          .then((comment) => {
            Posts.find({
              where: {
                id: comment.PostId
              }
            })
              .then((oldPost) => {
                oldPost.removeComments(comment);
                Posts.find({
                  where: {
                    id: newPostId
                  }
                })
                  .then((newPost) => {
                    comment.PostId = newPostId;
                    comment.save()
                      .then((comment) => {
                        newPost.addComments(comment);
                        sendNotification(comment, oldPost)
                        return ReS(res, {message: 'Comment '+ commentId + ' is now associated with Post '+ newPostId});
                      })

                  })
              })
            
            post.removeComment(comment);
            comment
          })
            
      } catch (e) {
        console.log(e)
        return ReE(res, {message:'Something went wrong.'});
      }
    } else {
      return ReE(res, {message:'Unathorized user'}, 401);
    }


}

module.exports.changeCommentAssociation = changeCommentAssociation;

/*
* this method fixes the previous comment-post association in which are no
* longer valid as some assoications were manually altered in the Comments table
* This method deletes the invalid records in PostComments table
*/
const fixCommentAssociation = async function (req, res) {
    if (req.user.id === 1) {
      const CONFIG = require('../config/config');

      const sequelize = new Sequelize(CONFIG.db_name, CONFIG.db_user, CONFIG.db_password, {
        host: CONFIG.db_host,
        dialect: CONFIG.db_dialect,
        port: CONFIG.db_port,
        operatorsAliases: false
      });

      sequelize.query('select * from PostComments').then(function(rows) {
        
        for (let i in rows[1]) {
          Comments.find({where: {
            PostId: rows[1][i].PostId,
            id: rows[1][i].CommentId
          }})
            .then((comment) => {
              if(!comment) {
                sequelize.query('delete from PostComments where PostId=' + rows[1][i].PostId + ' && CommentId=' + rows[1][i].CommentId).then(function(rows) {
                  console.log('Wrong association removed.')
                });

              }
            })
        }
      });
      return ReS(res, {message: 'Operation in progress..'});

    } else {
      return ReE(res, {message:'Unathorized user'}, 401);
    }


}

module.exports.fixCommentAssociation = fixCommentAssociation;

function optimizeImages (req, res) {
  if (req.user.id === 1) {
    try {
      const S3Controller   = require('./s3.controller');
      let s3 = S3Controller.getS3Config();
      let prefix = 'public/thumbs/';
      let params = {
        Bucket: s3.bucket,
        Prefix: prefix
      }
      let fileList = [];

      let optimizeFiles = function () {
        if (!fileList.length) {
          console.log('No images to optimize.')
        }
        let i = 0;
        let jobInProgress = false;
        let interval = setInterval(()=> {
          if (i < fileList.length && !jobInProgress) {
            jobInProgress = true;
            optimizeSingleFile(fileList[i])
              .then((d) => {
                if (i === fileList.length-1) {
                  clearInterval(interval)
                } else {
                  i++;  
                }
                
                jobInProgress = false;
              })  
          }
          
        }, 10000)
      }
      let optimizeSingleFile = function (key) {
        return new Promise(function (resolve, reject) {
          let localFileDir = appRoot + '/uploads/temp/'
          let baseName = path.basename(key);
          let localFilePath = localFileDir + baseName;
          let localFile = fs.createWriteStream(localFilePath);
          //console.log('data:image/' + path.extname(baseName).replace(".", '') + ';base64,');
          //localFile.write(Buffer.from('data:image/' + path.extname(baseName).replace(".", '') + ';base64,', 'binary'));
          s3.s3Obj.getObject({ Bucket: s3.bucket, Key: key})
            .on('error', function (err) {
                console.log(err);
                reject(err)
            })
            .on('httpData', function (chunk) {
                localFile.write(chunk);
            })
            .on('httpDone', function () {
                console.log('File ' + baseName + ' downloaded from S3');
                localFile.end();
                optimizeImage (localFilePath)
                  .then((stats) => {
                     S3Controller.deleteS3Object(baseName, prefix)
                       .then((d) => {
                          S3Controller.uploadToS3(localFilePath, prefix)
                            .then((d) => {
                              console.log('Optimized file ' + baseName + ' uploaded to S3');
                              resolve(d);
                            })
                       })
                      
                  })
            })
            .send();
        }) 
      }
      let isToday = (someDate) => {
        const today = new Date()
        return someDate.getDate() == today.getDate() &&
          someDate.getMonth() == today.getMonth() &&
          someDate.getFullYear() == today.getFullYear()
      }
      let getAllKeys = function (marker =  false) {
        if (marker) {
          params.Marker = marker
        }
        s3.s3Obj.listObjects(params, function (err, data) {
         if(err)throw err; 
         if(data.Contents && data.Contents.length) {
          for (let i in data.Contents) {
            if (data.Contents[i].Key !== prefix) {
              fileList.push(data.Contents[i].Key)
              //optimizeSingleFile(data.Contents[i].Key);
            }
          }
         }
         if(data.IsTruncated) {
          getAllKeys(data.NextMarker)
         } else {
           optimizeFiles();
         }
        });
      }
      getAllKeys();
      return ReS(res, {message: 'Operation in progress..'});
    } catch (e){
      console.log(e);
      return ReE(res, {message:'Something went wrong'});
    }
  } else {
    return ReE(res, {message:'Unathorized user'}, 401);
  }  
}

module.exports.optimizeImages = optimizeImages;

/*
module.exports.fakeIpRequests = async function (req, res) {
  var http = require('http');

  try {
    var options = {
    host: '159.89.245.63',
    port: 3128,
    path: 'http://frendsdom.com/test/IPTest.php',
    headers: {
      Host: "frendsdom.com/test/IPTest.php",     
    }
  };

  var req = http.request(options, function(response) {
    response.on('data', function (chunk) {
      console.log(chunk.toString());
    });
    response.on('error', function (e) {
      console.log(e);
    });

  }).end()
  } catch (e) {
    console.log(e)
  }

  

  return ReS(res, {message: 'Operation in progress..'});
}*/