var cp = require('child_process');
var path = require('path');
var fs = require('fs');
var Q = require('q');


function errorLog(error) {
    throw error;
}

function Git(cwd) {
    if (!fs.existsSync(cwd)) {
        throw new Error('Path \'' + cwd + '\' not found');
    }
    this.cwd = path.resolve(cwd);
}

Git.prototype.exec = function () {
    var that = this;

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

module.exports.clone = function(cwd, repo, dest) {
    var deferred = Q.defer(),
        args = ['clone', repo],
        working = new Git(cwd);

    if (dest !== undefined) {
        args.push(dest);
    }

    working.exec.apply(working, args)
    .then(function(repo) {
        var clone = new Git(path.resolve(cwd, repo.lastCommand.stderr.match(/Cloning into '(.*)'/)[1]));
        clone.lastCommand = repo.lastCommand;

        deferred.resolve(clone);

    }, function(err) {
        deferred.reject((err));
    });

    return deferred.promise;
};
