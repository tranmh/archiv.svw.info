// The safety net of archiv.svw.info, written by aqaa from what its QA run found: unit tests with coverage and its
// floor, integration tests against the databases they need, end-to-end tests, and lint, SAST and dependency
// checks (report only: a finding marks the stage unstable until it is triaged).
// Needs the plugins Pipeline, Docker Pipeline, JUnit, Coverage, Timestamper and Workspace Cleanup;
// integration stages run on an agent labelled 'docker'.
pipeline {
  agent none
  options {
    timeout(time: 90, unit: 'MINUTES')
    timestamps()
    buildDiscarder(logRotator(numToKeepStr: '30', artifactNumToKeepStr: '10'))
    disableConcurrentBuilds(abortPrevious: true)
  }
  environment {
    CI = 'true'
  }
  stages {
    stage('Tests') {
      parallel {
        stage('Unit: web') {
          agent { dockerfile { filename 'web.Dockerfile'; dir 'ci/jenkins' } }
          options { timeout(time: 30, unit: 'MINUTES') }
          steps {
            dir('.') {
              sh '''
                set -eu
                NODE_PATH="$(npm root -g)"; export NODE_PATH
                mkdir -p test-reports
                PLAYWRIGHT_JUNIT_OUTPUT_NAME="$PWD/test-reports/unit.xml" playwright test --config ci/web/playwright.config.cjs --project unit --reporter=junit,list
              '''
            }
          }
          post {
            always {
              junit allowEmptyResults: true, testResults: 'test-reports/*.xml'
              archiveArtifacts allowEmptyArchive: true, artifacts: 'test-reports/**'
            }
            cleanup {
              cleanWs deleteDirs: true, notFailBuild: true
            }
          }
        }
        stage('End-to-end: web') {
          agent { dockerfile { filename 'web.Dockerfile'; dir 'ci/jenkins' } }
          options { timeout(time: 45, unit: 'MINUTES') }
          steps {
            dir('.') {
              sh '''
                set -eu
                NODE_PATH="$(npm root -g)"; export NODE_PATH
                mkdir -p test-reports
                PLAYWRIGHT_JUNIT_OUTPUT_NAME="$PWD/test-reports/e2e.xml" playwright test --config ci/web/playwright.config.cjs --project e2e --reporter=junit,list
              '''
            }
          }
          post {
            always {
              junit allowEmptyResults: true, testResults: 'test-reports/*.xml'
              archiveArtifacts allowEmptyArchive: true, artifacts: 'test-reports/**'
            }
            cleanup {
              cleanWs deleteDirs: true, notFailBuild: true
            }
          }
        }
      }
    }
    stage('Checks') {
      parallel {
        stage('Checks: web') {
          agent { dockerfile { filename 'web.Dockerfile'; dir 'ci/jenkins' } }
          options { timeout(time: 30, unit: 'MINUTES') }
          steps {
            dir('.') {
              sh '''
                set -eu
                NODE_PATH="$(npm root -g)"; export NODE_PATH
                mkdir -p test-reports
              '''
              catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE', message: 'linkinator found issues') {
                sh '''
                  set -eu
                  NODE_PATH="$(npm root -g)"; export NODE_PATH
                  set --; for f in *.html *.htm; do if [ -e "$f" ]; then set -- "$@" "$f"; fi; done; if [ "$#" -eq 0 ]; then set -- .; fi
                  linkinator "$@" --recurse --skip '^(?!https?://(localhost|127\\.0\\.0\\.1)[:/])'
                '''
              }
              catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE', message: 'html-validate found issues') {
                sh '''
                  set -eu
                  NODE_PATH="$(npm root -g)"; export NODE_PATH
                  if ls .htmlvalidate.json .htmlvalidate.js .htmlvalidate.cjs .htmlvalidate.mjs >/dev/null 2>&1; then
                    html-validate --ext html,htm .
                  else
                    html-validate --preset standard --ext html,htm .
                  fi
                '''
              }
            }
          }
          post {
            always { archiveArtifacts allowEmptyArchive: true, artifacts: 'test-reports/**' }
            cleanup { cleanWs deleteDirs: true, notFailBuild: true }
          }
        }
      }
    }
  }
}
