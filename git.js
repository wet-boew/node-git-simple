var cp = require('child_process');
var path = require('path');
var fs = require('fs');
var Q = require('q');


function errorLog(error) {
    throw error;
}

function Git(cwd) {
    this.cwd = path.resolve(cwd);
}

Git.prototype.exec = function () {
    var that = this;
    if (!fs.existsSync(this.cwd)) {
        throw new Error('Path \'' + that.cwd + '\' not found');
    }

    var deferred = Q.defer(),
        args = Array.prototype.slice.call(arguments),
        stdout = '',
        stderr = '',
        process;

    process = cp.spawn('git', args, {cwd: that.cwd});

    process.stdout.on('data', function (data) {
        data = data.toString();
        stdout += data;
        deferred.notify(data);
    });
    process.stderr.on('data', function (data) {
        data = data.toString();
        stderr += data;
        deferred.notify(data);
    });

    process.on('close', function (code) {
        that.lastCommand = {
            command: args.concat(' '),
            stdout: stdout,
            stderr: stderr
        };
        if (code) {
            return deferred.reject(new Error('Failed to execute git "' + args.join(' ') + '", exit code of #' + code, 'ECMDERR'));
        }

        return deferred.resolve(that);
    });
    return deferred.promise;
};

module.exports = Git;

module.exports.create = function(cwd, bare) {
    var repo = new Git(cwd);

    if (bare) {
        return repo.exec('init', '--bare');
    } else {
       return repo.exec('init')
            .then(function(repo) {
                return repo.exec('add', '.');
            }, errorLog)
            .then(function(repo) {
                return repo.exec('commit', '-m', '"Initial commit"');
            }, errorLog);
    }
};

module.exports.clone = function(cwd, repo) {
    var deferred = Q.defer();

    new Git(cwd).exec('clone', repo)
    .then(function(repo) {
        var clone = new Git(path.resolve(cwd, repo.lastCommand.stderr.match(/Cloning into '(.*)'/)[1]));
        clone.lastCommand = repo.lastCommand;

        deferred.resolve(clone);

    }, function(err) {
        deferred.reject((err));
    });

    return deferred.promise;
};
