/* eslint-disable no-unused-expressions */
const nock = require('nock');
const cheerio = require('cheerio');
const chai = require('chai');
const chaiHttp = require('chai-http');
const server = require('../../server');
const getSampleResponse = require('../resources/getSampleResponse');
const constants = require('../../app/lib/constants');
const messages = require('../../app/lib/messages');

const expect = chai.expect;

chai.use(chaiHttp);

function checkHtmlResponse(err, res) {
  expect(err).to.be.null;
  expect(res).to.have.status(200);
  expect(res).to.be.html;
}

describe('The default page', () => {
  it('should return the link for stomach ache', (done) => {
    chai.request(server)
      .get(`${constants.SITE_ROOT}`)
      .end((err, res) => {
        checkHtmlResponse(err, res);

        const $ = cheerio.load(res.text);

        // Hardly robust but the page is in question of even existing
        expect($('ul.list-bullet li a').text())
          .to.equal('Stomach Ache');
        done();
      });
  });
});

describe('The stomach ache page', () => {
  it('should contain content for stomach ache', (done) => {
    chai.request(server)
      .get(`${constants.SITE_ROOT}/stomach-ache`)
      .end((err, res) => {
        checkHtmlResponse(err, res);

        const $ = cheerio.load(res.text);

        expect($('.local-header--title').text())
          .to.equal('Stomach ache');
        done();
      });
  });
});

describe('The find help page', () => {
  it('should contain content for finding help with stomach ache', (done) => {
    chai.request(server)
      .get(`${constants.SITE_ROOT}/find-help`)
      .end((err, res) => {
        checkHtmlResponse(err, res);

        const $ = cheerio.load(res.text);

        expect($('.local-header--title--question').text().trim())
          .to.equal('Find a pharmacy');
        done();
      });
  });

  it('should provide a prompt to enter a postcode', (done) => {
    chai.request(server)
      .get(`${constants.SITE_ROOT}/find-help`)
      .end((err, res) => {
        checkHtmlResponse(err, res);

        const $ = cheerio.load(res.text);

        expect($('.local-header--title--question').text().trim())
          .to.equal('Find a pharmacy');
        done();
      });
  });
});

describe('The file loading results page', () => {
  const postcode = 'AB123CD';
  const postcodeioResponse = getSampleResponse('postcodesio-responses/ls27ue.json');
  const resultsRoute = `${constants.SITE_ROOT}/results`;

  describe('happy paths', () => {
    nock('https://api.postcodes.io')
      .get(/.*/)
      .times(2)
      .reply(200, postcodeioResponse);

    it('should return 3 open results, by default', (done) => {
      chai.request(server)
        .get(resultsRoute)
        .query({ location: postcode })
        .end((err, res) => {
          checkHtmlResponse(err, res);
          const $ = cheerio.load(res.text);

          const mapLinks = $('.cta-blue');
          // Some arbitary element to suggest there are 3 results
          expect(mapLinks.length).to.equal(3);
          mapLinks.toArray().forEach((link) => {
            expect($(link).attr('href')).to.have.string('https://www.google.com');
          });
          expect($('.list-tab__link').attr('href'))
            .to.equal(`${constants.SITE_ROOT}/results?location=${postcode}&open=false`);
          // TODO: Check the specific results are correct, as loaded from the known file
          // TODO: When the postcode lookup is done to get the coords that request will need mocking
          done();
        });
    });

    it('should return 10 results', (done) => {
      chai.request(server)
        .get(resultsRoute)
        .query({ location: postcode, open: false })
        .end((err, res) => {
          checkHtmlResponse(err, res);
          const $ = cheerio.load(res.text);

          const mapLinks = $('.cta-blue');
          // Some arbitary element to suggest there are 10 results
          expect(mapLinks.length).to.equal(10);
          mapLinks.toArray().forEach((link) => {
            expect($(link).attr('href')).to.have.string('https://www.google.com');
          });
          expect($('.list-tab__link').attr('href'))
            .to.equal(`${constants.SITE_ROOT}/results?location=${postcode}&open=true`);
          // TODO: Check the specific results are correct, as loaded from the known file
          // TODO: When the postcode lookup is done to get the coords that request will need mocking
          done();
        });
    });
  });

  describe('error handling', () => {
    const notFoundResponse = getSampleResponse('postcodesio-responses/404.json');
    const invalidPostcodePassingRegex = 'LS0';

    const postcodesioScope =
    nock('https://api.postcodes.io')
      .get(`/outcodes/${invalidPostcodePassingRegex}`)
      .times(1)
      .reply(404, notFoundResponse);

    it('should lookup a syntactically valid but unknown postcode and return an error message',
        (done) => {
          chai.request(server)
            .get(resultsRoute)
            .query({ location: invalidPostcodePassingRegex })
            .end((err, res) => {
              checkHtmlResponse(err, res);
              expect(res.text).to
                .contain(messages.invalidPostcodeMessage(invalidPostcodePassingRegex));
              expect(postcodesioScope.isDone()).to.equal(true);
              done();
            });
        });

    it('should validate the postcode and return an error message', (done) => {
      const invalidPostcode = 'invalid';
      const errorMessage =
        `${invalidPostcode} is not a valid postcode, please try again`;

      chai.request(server)
        .get(resultsRoute)
        .query({ location: invalidPostcode })
        .end((err, res) => {
          checkHtmlResponse(err, res);
          expect(res.text).to.contain(errorMessage);
          done();
        });
    });
  });
});
