/* eslint-disable no-case-declarations */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { useEffect, useState } from 'react';
import MoveSound from '../../public/move.wav';
import { Button } from '../components/Button';
import { ChessBoard, isPromoting } from '../components/ChessBoard';
import { useSocket } from '../hooks/useSocket';
import { Chess, Move, Square } from 'chess.js';
import { useNavigate, useParams } from 'react-router-dom';
import MovesTable from '../components/MovesTable';
import { useUser } from '@repo/store/useUser';
import { UserAvatar } from '../components/UserAvatar';

// TODO: Move together, there's code repetition here
export const INIT_GAME = 'init_game';
export const MOVE = 'move';
export const OPPONENT_DISCONNECTED = 'opponent_disconnected';
export const GAME_OVER = 'game_over';
export const JOIN_ROOM = 'join_room';
export const GAME_JOINED = 'game_joined';
export const GAME_ALERT = 'game_alert';
export const GAME_ADDED = 'game_added';
export const USER_TIMEOUT = 'user_timeout';
export const GAME_TIME = 'game_time';

const GAME_TIME_MS = 10 * 60 * 1000;

export interface IMove {
    from: Square; to: Square; piece: string
}

const moveAudio = new Audio(MoveSound);

interface Metadata {
  blackPlayer: { id: string; name: string };
  whitePlayer: { id: string; name: string };
}

export const Game = () => {
  const socket = useSocket();
  const { gameId } = useParams();
  const user = useUser();

  const navigate = useNavigate();
  // Todo move to store/context
  const [chess, _setChess] = useState(new Chess());
  const [board, setBoard] = useState(chess.board());
  const [added, setAdded] = useState(false);
  const [started, setStarted] = useState(false);
  const [gameMetadata, setGameMetadata] = useState<Metadata | null>(null);
  const [result, setResult] = useState<
    | 'WHITE_WINS'
    | 'BLACK_WINS'
    | 'DRAW'
    | typeof OPPONENT_DISCONNECTED
    | typeof USER_TIMEOUT
    | null
  >(null);
  const [moves, setMoves] = useState<IMove[]>([]);
  const [player1TimeConsumed, setPlayer1TimeConsumed] = useState(0);
  const [player2TimeConsumed, setPlayer2TimeConsumed] = useState(0);

  useEffect(() => {
    if (!socket) {
      return;
    }
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case GAME_ADDED:
          setAdded(true);
          break;
        case INIT_GAME:
          setBoard(chess.board());
          setStarted(true);
          navigate(`/game/${message.payload.gameId}`);
          setGameMetadata({
            blackPlayer: message.payload.blackPlayer,
            whitePlayer: message.payload.whitePlayer,
          });
          break;
        case MOVE:
          const { move, player1TimeConsumed, player2TimeConsumed } = message.payload;
          setPlayer1TimeConsumed(player1TimeConsumed);
          setPlayer2TimeConsumed(player2TimeConsumed);
          const moves = chess.moves({ verbose: true });
          //TODO: Fix later
          if (
            moves.map((x) => JSON.stringify(x)).includes(JSON.stringify(move))
          ) {
            return;
          }
          console.log(move);
          if (isPromoting(chess, move.from, move.to)) {
            chess.move({
              from: move.from,
              to: move.to,
              promotion: 'q',
            });
          } else {
            chess.move({ from: move.from, to: move.to });
          }
          moveAudio.play();
          setBoard(chess.board());
          const piece=chess.get(move.to)?.type
          setMoves(moves => [...moves,{from:move.from,to:move.to,piece}])
          break;
        case GAME_OVER:
          setResult(message.payload.result);
          break;

        case OPPONENT_DISCONNECTED:
          setResult(OPPONENT_DISCONNECTED);
          break;

        case USER_TIMEOUT:
          setResult(message.payload.win);
          break;

        case GAME_JOINED:
          setGameMetadata({
            blackPlayer: message.payload.blackPlayer,
            whitePlayer: message.payload.whitePlayer,
          });
          setPlayer1TimeConsumed(message.payload.player1TimeConsumed);
          setPlayer2TimeConsumed(message.payload.player2TimeConsumed);
          console.error(message.payload)
          setStarted(true);
          setMoves(message.payload.moves);
          message.payload.moves.map((x: Move) => {
            if (isPromoting(chess, x.from, x.to)) {
              chess.move({ ...x, promotion: 'q' });
            } else {
              chess.move(x);
            }
          });
          setBoard(chess.board());
          break;

        case GAME_TIME:
          if (message.payload.player2UserId === user.id) {
            setMyTimer(message.payload.player2Time);
            setOppotentTimer(message.payload.player1Time);
          } else {
            setMyTimer(message.payload.player1Time);
            setOppotentTimer(message.payload.player2Time);
          }
          break;

        default:
          alert(message.payload.message);
          break;
      }
    };

    if (gameId !== 'random') {
      socket.send(
        JSON.stringify({
          type: JOIN_ROOM,
          payload: {
            gameId,
          },
        }),
      );
    }
  }, [chess, socket]);

  useEffect(() => {
    if (started) {
      const interval = setInterval(() => {
        if (
          chess.turn() === 'w'
        ) {
          setPlayer1TimeConsumed((p) => p + 100);
        } else {
          setPlayer2TimeConsumed((p) => p + 100);
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, [started, gameMetadata, user]);

  const getTimer = (timeConsumed: number) => {
    const timeLeftMs = GAME_TIME_MS - timeConsumed;
    const minutes = Math.floor(timeLeftMs / (1000 * 60));
    const remainingSeconds = Math.floor((timeLeftMs % (1000 * 60)) / 1000);

    return (
      <div className="text-white">
        Time Left: {minutes < 10 ? '0' : ''}
        {minutes}:{remainingSeconds < 10 ? '0' : ''}
        {remainingSeconds}
      </div>
    );
  };

  if (!socket) return <div>Connecting...</div>;

  return (
    <div className="">
      {result && (
        <div className="justify-center flex pt-4 text-white">
          {result === 'WHITE_WINS' && 'White wins'}
          {result === 'BLACK_WINS' && 'Black wins'}
          {result === 'DRAW' && 'Draw'}
        </div>
      )}
      {started && (
        <div className="justify-center flex pt-4 text-white">
          {(user.id === gameMetadata?.blackPlayer?.id ? 'b' : 'w') ===
          chess.turn()
            ? 'Your turn'
            : "Opponent's turn"}
        </div>
      )}
      <div className="justify-center flex">
        <div className="pt-2 max-w-screen-xl w-full">
          <div className="grid grid-cols-7 gap-4 w-full">
            <div className="col-span-7 lg:col-span-5 w-full text-white">
              <div className="flex justify-center">
                <div>
                  <div className='mb-4'>
                    {started && <div className="flex justify-between">
                      <UserAvatar name={user.id === gameMetadata?.whitePlayer?.id
                          ? gameMetadata?.blackPlayer?.name
                          : gameMetadata?.whitePlayer?.name ?? ''} />
                      {getTimer(user.id === gameMetadata?.whitePlayer?.id ? player2TimeConsumed : player1TimeConsumed)}
                    </div>}
                  </div>
                  <div>
                    <div
                      className={`col-span-4 w-full flex justify-center text-white ${(result === OPPONENT_DISCONNECTED || result === USER_TIMEOUT) && 'pointer-events-none'}`}
                    >
                      <ChessBoard
                        started={started}
                        gameId={gameId ?? ''}
                        myColor={
                          user.id === gameMetadata?.blackPlayer?.id ? 'b' : 'w'
                        }
                        setMoves={setMoves}
                        moves={moves}
                        chess={chess}
                        setBoard={setBoard}
                        socket={socket}
                        board={board}
                      />
                    </div>
                  </div>
                  {started && <div className="mt-4 flex justify-between">
                    <UserAvatar name={user.id === gameMetadata?.blackPlayer?.id
                      ? gameMetadata?.blackPlayer?.name
                      : gameMetadata?.whitePlayer?.name ?? ''} />
                    {getTimer(user.id === gameMetadata?.blackPlayer?.id
                            ? player2TimeConsumed
                            : player1TimeConsumed)}
                  </div>}
                </div>
              </div>
            </div>
            <div className="col-span-2 bg-brown-500 w-full flex justify-center h-[90vh] overflow-scroll mt-10 overflow-y-scroll no-scrollbar">
              {!started && (
                <div className="pt-8">
                  {added ? (
                    <div className="text-white">Waiting</div>
                  ) : (
                    gameId === 'random' && (
                      <Button
                        onClick={() => {
                          socket.send(
                            JSON.stringify({
                              type: INIT_GAME,
                            }),
                          );
                        }}
                      >
                        Play
                      </Button>
                    )
                  )}
                </div>
              )}
              <div>
                {moves.length > 0 && (
                  <div className="mt-4">
                    <MovesTable moves={moves} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        {/* <UserAvatar name={gameMetadata?.whitePlayer?.name ?? ""} /> */}
      </div>
    </div>
  );
};
