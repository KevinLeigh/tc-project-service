'use strict'

var chai = require('chai'),
  expect = chai.expect,
  should = chai.should(),
  _ = require('lodash'),
  sinon = require('sinon'),
  request = require('supertest'),
  models = require('../../../app/models'),
  util = require('../../../app/util'),
  server = require('../../../app'),
  testUtil = require('../../tests/util')

describe('GET Project', λ => {
  var project1, project2
  before(done =>  {
    testUtil.clearDb()
      .then(() => {
        var p1 = models.Project.create({
          type: 'generic',
          billingAccountId: '1',
          title: 'test1',
          description: 'test project1',
          status: 'draft',
          details: {},
          createdBy: 1,
          updatedBy: 1
        }).then(p => {
          project1 = p
            // create members
          var pm1 = models.ProjectMember.create({
            userId: 40051331,
            projectId: project1.id,
            role: 'customer',
            isPrimary: true,
            createdBy: 1,
            updatedBy: 1
          })
          var pm2 = models.ProjectMember.create({
            userId: 40051333,
            projectId: project1.id,
            role: 'copilot',
            isPrimary: true,
            createdBy: 1,
            updatedBy: 1
          })
          return Promise.all([pm1, pm2])
        })

        var p2 = models.Project.create({
          type: 'visual_design',
          billingAccountId: '1',
          title: 'test2',
          description: 'test project2',
          status: 'draft',
          details: {},
          createdBy: 1,
          updatedBy: 1
        }).then(p => {
          project2 = p
        })
        return Promise.all([p1, p2])
          .then(() => done())
          .catch((err) => {
            console.log(err)
          })
      })

  })

  after(done =>  {
    testUtil.clearDb(done)
  })

  describe('GET /projects/{id}', () => {
    it('should return 403 if user is not authenticated', done =>  {
      console.log(server)
      request(server)
        .get('/v4/projects/' + project2.id)
        .expect(403, done)
    })

    it('should return 404 if requested project doesn\'t exist', done =>  {
      request(server)
        .get('/v4/projects/14343323')
        .set({
          'Authorization': 'Bearer ' + testUtil.jwts.admin
        })
        .expect(404, done)
    })

    it('should return 404 if user does not have access to the project', done =>  {
      request(server)
        .get('/v4/projects/' + project2.id)
        .set({
          'Authorization': 'Bearer ' + testUtil.jwts.member
        })
        .expect(403, done)
    })

    it('should return the project when registerd member attempts to access the project', done =>  {
      request(server)
        .get('/v4/projects/' + project1.id + '/?fields=id%2Ctitle%2Cstatus%2Cmembers.role%2Cmembers.id%2Cmembers.userId')
        .set({
          'Authorization': 'Bearer ' + testUtil.jwts.member
        })
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err)
          }
          var resJson = res.body.result.content
          should.exist(resJson)
          should.not.exist(resJson.deletedAt)
          should.not.exist(resJson.billingAccountId)
          should.exist(resJson.title)
          resJson.status.should.be.eql('draft')
          resJson.members.should.have.lengthOf(2)
          done()
        })
    })

    it('should return the project for administrator ', done =>  {
      request(server)
        .get('/v4/projects/' + project1.id)
        .set({
          'Authorization': 'Bearer ' + testUtil.jwts.admin
        })
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err)
          }
          var resJson = res.body.result.content
          should.exist(resJson)
          done()
        })
    })

    it('should return attachment with downloadUrl', done =>  {
      models.ProjectAttachment.create({
        projectId: project1.id,
        filePath: 'projects/1/spec.pdf',
        contentType: 'application/pdf',
        createdBy: 1,
        updatedBy: 1,
        title: 'spec.pdf',
        description: 'blah'
      }).then((attachment) => {
        var mockHttpClient = {
          defaults: { headers: { common: {} } },
          post: () => {
            return new Promise((resolve, reject) => {
              return resolve({
                status: 200,
                data: {
                  result: {
                    status: 200,
                    content: {
                      filePath: 'projects/1/spec.pdf',
                      preSignedURL: 'https://www.topcoder-dev.com/downloadUrl'
                    }
                  }
                }
              })
            })
          }
        }
        var spy = sinon.spy(mockHttpClient, 'post')
        var stub = sinon.stub(util, 'getHttpClient', () => { return mockHttpClient } )

        request(server)
          .get('/v4/projects/' + project1.id)
          .set({
            'Authorization': 'Bearer ' + testUtil.jwts.admin
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err)
            }
            var resJson = res.body.result.content
            should.exist(resJson)
            spy.should.have.been.calledOnce
            resJson.attachments.should.have.lengthOf(1)
            resJson.attachments[0].filePath.should.equal(attachment.filePath)
            resJson.attachments[0].downloadUrl.should.exist
            stub.restore()
            done()
          })

      })

    })
  })

})
