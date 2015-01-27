angular.module('starter.controllers', [])

    .controller('DashCtrl', function ($scope, $http) {
        var book = {
            sequence: 0,
            asks: [],
            bids: []
        };
        var bookView = {
            asks: [],
            bids: []
        };
        $scope.bookView = bookView;
        $scope.latest = {};
        $scope.trades = [];

        function sum(items) {
            var s = 0;
            for (var i = 0; i < items.length; i++) {
                var item = items[i];
                s += parseFloat(item.size);
            }
            return s;
        }

        var queuedMessages = [];


        $http.get('https://api.exchange.coinbase.com/products/BTC-USD/ticker').success(function (data) {
            $scope.latest = {price: data.price, size: data.size, total: (data.size * data.price).toFixed(2).toString()};
            $scope.trades.push($scope.latest);
        });


        $http.get('https://api.exchange.coinbase.com/products/BTC-USD/book?level=3').success(function (data) {

            book.sequence = data.sequence;

            book.asks = data.asks.map(function (m) {
                return {price: parseFloat(m[0]), size: parseFloat(m[1]), order_id: m[2]}
            });
            book.bids = data.bids.map(function (m) {
                return {price: parseFloat(m[0]), size: parseFloat(m[1]), order_id: m[2]}
            });

            for (var i = 0; i < queuedMessages.length; i++) {
                var message = queuedMessages[i];
                if (message.sequence <= book.sequence) {
                    continue;
                }
                addMessageToBook(message);
            }
            buildBookView();
        });

        function buildBookView() {


            var asks = {};
            for (var i = 0; i < book.asks.length; i++) {
                var ask = book.asks[i];
                if (!asks[ask.price]) {
                    asks[ask.price] = [];
                }
                asks[ask.price].push(ask);
            }


            var bids = {};
            for (var i = 0; i < book.bids.length; i++) {
                var bid = book.bids[i];
                if (!bids[bid.price]) {
                    bids[bid.price] = [];
                }
                bids[bid.price].push(bid);
            }

            var _asks = [];
            for (var ask in asks) {
                if (asks.hasOwnProperty(ask)) {
                    _asks.push({price: ask, size: sum(asks[ask])});
                }
            }
            var _bids = [];
            for (var bid in bids) {
                if (bids.hasOwnProperty(bid)) {
                    _bids.push({price: bid, size: sum(bids[bid])});
                }
            }


            _asks.sort(function (a, b) {
                return b.price - a.price
            });
            _bids.sort(function (a, b) {
                return b.price - a.price
            });


            bookView.asks = _asks.slice(-20).map(function (m) {
                return {
                    price: pad(parseFloat(m.price).toPrecision(10), 16, '0'),
                    size: pad(parseFloat(m.size).toPrecision(10), 16, '0'),
                    total: (m.size * m.price).toFixed(2).toString()
                }
            });
            bookView.bids = _bids.slice(0, 20).map(function (m) {
                return {
                    price: pad(parseFloat(m.price).toPrecision(10), 16, '0'),
                    size: pad(parseFloat(m.size).toPrecision(10), 16, '0'),
                    total: (m.size * m.price).toFixed(2).toString()
                }
            });


        }


        function addMessageToBook(message) {
            switch (message.type) {
                case "open":
                    var items;
                    if (message.side == 'buy') {
                        items = book.bids;
                    }
                    if (message.side == 'sell') {
                        items = book.asks;
                    }

                    items.push({price: message.price, size: message.remaining_size, order_id: message.order_id})

                    break;
                case "received":
                    break;
                case "change":

                    break;
                case "done":
                    var items;
                    if (message.side == 'buy') {
                        items = book.bids;
                    }
                    if (message.side == 'sell') {
                        items = book.asks;
                    }


                            for (var i = 0; i < items.length; i++) {
                                if (items[i].order_id == message.order_id) {
                                    items.splice(i, 1);
                                    break;
                                }
                            }

                    break;
                case "match":
                    for (var i = 0; i < book.bids.length; i++) {
                        var bid = book.bids[i];
                        if (bid.order_id == message.maker_order_id || bid.order_id == message.taker_order_id) {
                            book.bids.splice(i, 1);
                        }
                    }
                    for (var i = 0; i < book.asks.length; i++) {
                        var ask = book.asks[i];
                        if (ask.order_id == message.maker_order_id || ask.order_id == message.taker_order_id) {
                            book.asks.splice(i, 1);
                        }
                    }
                    $scope.latest = {
                        price: message.price,
                        size: message.size,
                        total: (message.size * message.price).toFixed(2).toString()
                    };

                    if ($scope.trades[0].price > $scope.latest.price) {
                        $scope.latest.bad = true;
                    }
                    if ($scope.trades[0].price < $scope.latest.price) {
                        $scope.latest.bad = false;
                    }
                    if ($scope.trades[0].price == $scope.latest.price) {
                        $scope.latest.bad = $scope.trades[0].bad;
                    }

                    $scope.trades.splice(0, 0, $scope.latest);
                    $scope.trades = $scope.trades.slice(0, 20);
                    break;

                default:

                    console.log(message);
                    break;

            }


        }


        var exampleSocket = new WebSocket("wss://ws-feed.exchange.coinbase.com");
        exampleSocket.onopen = function () {
            exampleSocket.send(JSON.stringify({"type": "subscribe", "product_id": "BTC-USD"}))
        };
        $scope.items = [];
        exampleSocket.onmessage = function (event) {
            var data = JSON.parse(event.data);
            console.log(data);
            if (book.sequence == 0) {
                queuedMessages.push(data);
            }
            else {
                addMessageToBook(data);

                buildBookView();
                $scope.$apply();
            }
        };

        exampleSocket.onerror = function (event) {
            console.log(event);
        };
        exampleSocket.onclose = function (event) {
            console.log(event);
        }


    })
;


/**
 *
 *  Javascript string pad
 *  http://www.webtoolkit.info/
 *
 **/

var STR_PAD_LEFT = 1;
var STR_PAD_RIGHT = 2;
var STR_PAD_BOTH = 3;

function pad(str, len, pad, dir) {

    if (typeof(len) == "undefined") {
        var len = 0;
    }
    if (typeof(pad) == "undefined") {
        var pad = ' ';
    }
    if (typeof(dir) == "undefined") {
        var dir = STR_PAD_RIGHT;
    }

    if (len + 1 >= str.length) {

        switch (dir) {

            case STR_PAD_LEFT:
                str = Array(len + 1 - str.length).join(pad) + str;
                break;

            case STR_PAD_BOTH:
                var right = Math.ceil((padlen = len - str.length) / 2);
                var left = padlen - right;
                str = Array(left + 1).join(pad) + str + Array(right + 1).join(pad);
                break;

            default:
                str = str + Array(len + 1 - str.length).join(pad);
                break;

        } // switch

    }

    return str;

}